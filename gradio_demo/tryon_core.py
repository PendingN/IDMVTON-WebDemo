import contextlib
import random
import sys
import threading
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import torch
from PIL import Image
from torchvision import transforms
from torchvision.transforms.functional import to_pil_image


ROOT_DIR = Path(__file__).resolve().parents[1]
GRADIO_DIR = Path(__file__).resolve().parent
EXAMPLE_DIR = GRADIO_DIR / "example"
DENSEPOSE_CONFIG = ROOT_DIR / "configs" / "densepose_rcnn_R_50_FPN_s1x.yaml"
DENSEPOSE_CKPT = ROOT_DIR / "ckpt" / "densepose" / "model_final_162be9.pkl"

for path in (ROOT_DIR, GRADIO_DIR):
    path_str = str(path)
    if path_str not in sys.path:
        sys.path.insert(0, path_str)


def pil_to_binary_mask(pil_image: Image.Image, threshold: int = 0) -> Image.Image:
    np_image = np.array(pil_image)
    grayscale_image = Image.fromarray(np_image).convert("L")
    binary_mask = np.array(grayscale_image) > threshold
    mask = np.zeros(binary_mask.shape, dtype=np.uint8)
    mask[binary_mask] = 255
    return Image.fromarray(mask)


def compute_center_crop_box(width: int, height: int) -> Tuple[int, int, int, int]:
    target_width = int(min(width, height * (3 / 4)))
    target_height = int(min(height, width * (4 / 3)))
    left = int((width - target_width) / 2)
    top = int((height - target_height) / 2)
    right = int((width + target_width) / 2)
    bottom = int((height + target_height) / 2)
    return left, top, right, bottom


def list_example_assets() -> Dict[str, List[Path]]:
    cloth_dir = EXAMPLE_DIR / "cloth"
    human_dir = EXAMPLE_DIR / "human"
    cloth_examples = sorted(path for path in cloth_dir.iterdir() if path.is_file())
    human_examples = sorted(path for path in human_dir.iterdir() if path.is_file())
    return {
        "cloth": cloth_examples,
        "human": human_examples,
    }


class TryonService:
    def __init__(self, base_path: str = "yisol/IDM-VTON", device: Optional[str] = None) -> None:
        self.base_path = base_path
        self.device = device or ("cuda:0" if torch.cuda.is_available() else "cpu")
        self.tensor_transform = transforms.Compose(
            [
                transforms.ToTensor(),
                transforms.Normalize([0.5], [0.5]),
            ]
        )
        self._load_lock = threading.Lock()
        self._loaded = False
        self._densepose_args = None

    def _load_models(self) -> None:
        if self._loaded:
            return

        with self._load_lock:
            if self._loaded:
                return

            from diffusers import AutoencoderKL, DDPMScheduler
            from src.tryon_pipeline import StableDiffusionXLInpaintPipeline as TryonPipeline
            from src.unet_hacked_garmnet import UNet2DConditionModel as UNet2DConditionModelRef
            from src.unet_hacked_tryon import UNet2DConditionModel
            from transformers import (
                AutoTokenizer,
                CLIPImageProcessor,
                CLIPTextModel,
                CLIPTextModelWithProjection,
                CLIPVisionModelWithProjection,
            )
            from preprocess.humanparsing.run_parsing import Parsing
            from preprocess.openpose.run_openpose import OpenPose

            self.unet = UNet2DConditionModel.from_pretrained(
                self.base_path,
                subfolder="unet",
                torch_dtype=torch.float16,
            )
            self.unet.requires_grad_(False)

            self.tokenizer_one = AutoTokenizer.from_pretrained(
                self.base_path,
                subfolder="tokenizer",
                revision=None,
                use_fast=False,
            )
            self.tokenizer_two = AutoTokenizer.from_pretrained(
                self.base_path,
                subfolder="tokenizer_2",
                revision=None,
                use_fast=False,
            )
            self.noise_scheduler = DDPMScheduler.from_pretrained(self.base_path, subfolder="scheduler")

            self.text_encoder_one = CLIPTextModel.from_pretrained(
                self.base_path,
                subfolder="text_encoder",
                torch_dtype=torch.float16,
            )
            self.text_encoder_two = CLIPTextModelWithProjection.from_pretrained(
                self.base_path,
                subfolder="text_encoder_2",
                torch_dtype=torch.float16,
            )
            self.image_encoder = CLIPVisionModelWithProjection.from_pretrained(
                self.base_path,
                subfolder="image_encoder",
                torch_dtype=torch.float16,
            )
            self.vae = AutoencoderKL.from_pretrained(
                self.base_path,
                subfolder="vae",
                torch_dtype=torch.float16,
            )
            self.unet_encoder = UNet2DConditionModelRef.from_pretrained(
                self.base_path,
                subfolder="unet_encoder",
                torch_dtype=torch.float16,
            )

            if not torch.cuda.is_available():
                raise RuntimeError(
                    "CUDA GPU is required. "
                    "In Colab, select Runtime > Change runtime type > T4 GPU."
                )

            cuda_index = (
                int(self.device.split(":", 1)[1])
                if ":" in self.device
                else 0
            )

            torch.cuda.set_device(cuda_index)

            self.parsing_model = Parsing(cuda_index)
            self.openpose_model = OpenPose(cuda_index)
            for module in (
                self.unet,
                self.unet_encoder,
                self.image_encoder,
                self.vae,
                self.text_encoder_one,
                self.text_encoder_two,
            ):
                module.requires_grad_(False)

            self.pipe = TryonPipeline.from_pretrained(
                self.base_path,
                unet=self.unet,
                vae=self.vae,
                feature_extractor=CLIPImageProcessor(),
                text_encoder=self.text_encoder_one,
                text_encoder_2=self.text_encoder_two,
                tokenizer=self.tokenizer_one,
                tokenizer_2=self.tokenizer_two,
                scheduler=self.noise_scheduler,
                image_encoder=self.image_encoder,
                torch_dtype=torch.float16,
            )
            self.pipe.unet_encoder = self.unet_encoder
            self._loaded = True

    def preload(self) -> None:
        self._load_models()

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def _get_densepose_args(self):
        if self._densepose_args is not None:
            return self._densepose_args

        import apply_net

        device_name = "cuda" if self.device.startswith("cuda") else "cpu"
        self._densepose_args = apply_net.create_argument_parser().parse_args(
            (
                "show",
                str(DENSEPOSE_CONFIG),
                str(DENSEPOSE_CKPT),
                "dp_segm",
                "-v",
                "--opts",
                "MODEL.DEVICE",
                device_name,
            )
        )
        return self._densepose_args

    def _build_pose_image(self, human_img: Image.Image) -> Image.Image:
        from detectron2.data.detection_utils import _apply_exif_orientation, convert_PIL_to_numpy

        human_img_arg = _apply_exif_orientation(human_img.resize((384, 512)))
        human_img_arg = convert_PIL_to_numpy(human_img_arg, format="BGR")
        args = self._get_densepose_args()
        pose_img = args.func(args, human_img_arg)
        pose_img = pose_img[:, :, ::-1]
        return Image.fromarray(pose_img).resize((768, 1024))

    def _prepare_mask(
        self,
        human_img: Image.Image,
        auto_mask: bool,
        manual_mask: Optional[Image.Image],
    ) -> Tuple[Image.Image, Image.Image]:
        if auto_mask:
            from utils_mask import get_mask_location

            keypoints = self.openpose_model(human_img.resize((384, 512)))
            model_parse, _ = self.parsing_model(human_img.resize((384, 512)))
            mask, _ = get_mask_location("hd", "upper_body", model_parse, keypoints)
            mask = mask.resize((768, 1024))
        else:
            if manual_mask is None:
                raise ValueError("Manual mask is required when auto mask is disabled.")
            mask = pil_to_binary_mask(manual_mask.convert("RGB").resize((768, 1024)))

        mask_gray = (1 - transforms.ToTensor()(mask)) * self.tensor_transform(human_img)
        mask_preview = to_pil_image((mask_gray + 1.0) / 2.0)
        return mask, mask_preview

    def run(
        self,
        human_image: Image.Image,
        garment_image: Image.Image,
        garment_description: str,
        auto_mask: bool = True,
        auto_crop: bool = False,
        denoise_steps: int = 30,
        seed: Optional[int] = 42,
        manual_mask: Optional[Image.Image] = None,
    ) -> Dict[str, object]:
        self._load_models()

        if garment_image is None:
            raise ValueError("Garment image is required.")
        if human_image is None:
            raise ValueError("Human image is required.")

        garment_description = (garment_description or "").strip() or "upper-body garment"
        denoise_steps = int(denoise_steps)

        if seed is None or int(seed) < 0:
            seed = random.randint(0, 2_147_483_647)
        actual_seed = int(seed)

        self.openpose_model.preprocessor.body_estimation.model.to(self.device)
        self.pipe.to(self.device)
        self.pipe.unet_encoder.to(self.device)

        garm_img = garment_image.convert("RGB").resize((768, 1024))
        human_img_orig = human_image.convert("RGB")

        crop_box = None
        crop_size = None
        if auto_crop:
            crop_box = compute_center_crop_box(*human_img_orig.size)
            cropped_img = human_img_orig.crop(crop_box)
            crop_size = cropped_img.size
            human_img = cropped_img.resize((768, 1024))
            if manual_mask is not None:
                manual_mask = manual_mask.convert("L")

                if manual_mask.size != human_img_orig.size:
                    manual_mask = manual_mask.resize(
                        human_img_orig.size,
                        Image.Resampling.NEAREST,
                    )

                manual_mask = manual_mask.crop(crop_box)
        else:
            human_img = human_img_orig.resize((768, 1024))

        mask, mask_preview = self._prepare_mask(
            human_img=human_img,
            auto_mask=auto_mask,
            manual_mask=manual_mask,
        )
        pose_img = self._build_pose_image(human_img)

        with torch.no_grad():
            autocast_context = (
                torch.cuda.amp.autocast() if self.device.startswith("cuda") else contextlib.nullcontext()
            )
            with autocast_context:
                prompt = "model is wearing " + garment_description
                negative_prompt = "monochrome, lowres, bad anatomy, worst quality, low quality"

                (
                    prompt_embeds,
                    negative_prompt_embeds,
                    pooled_prompt_embeds,
                    negative_pooled_prompt_embeds,
                ) = self.pipe.encode_prompt(
                    prompt,
                    num_images_per_prompt=1,
                    do_classifier_free_guidance=True,
                    negative_prompt=negative_prompt,
                )

                cloth_prompt = "a photo of " + garment_description
                (
                    prompt_embeds_c,
                    _,
                    _,
                    _,
                ) = self.pipe.encode_prompt(
                    [cloth_prompt],
                    num_images_per_prompt=1,
                    do_classifier_free_guidance=False,
                    negative_prompt=[negative_prompt],
                )

                pose_tensor = self.tensor_transform(pose_img).unsqueeze(0).to(self.device, torch.float16)
                garm_tensor = self.tensor_transform(garm_img).unsqueeze(0).to(self.device, torch.float16)
                generator = torch.Generator(self.device).manual_seed(actual_seed)

                images = self.pipe(
                    prompt_embeds=prompt_embeds.to(self.device, torch.float16),
                    negative_prompt_embeds=negative_prompt_embeds.to(self.device, torch.float16),
                    pooled_prompt_embeds=pooled_prompt_embeds.to(self.device, torch.float16),
                    negative_pooled_prompt_embeds=negative_pooled_prompt_embeds.to(
                        self.device, torch.float16
                    ),
                    num_inference_steps=denoise_steps,
                    generator=generator,
                    strength=1.0,
                    pose_img=pose_tensor,
                    text_embeds_cloth=prompt_embeds_c.to(self.device, torch.float16),
                    cloth=garm_tensor,
                    mask_image=mask,
                    image=human_img,
                    height=1024,
                    width=768,
                    ip_adapter_image=garm_img.resize((768, 1024)),
                    guidance_scale=2.0,
                )[0]

        output_image = images[0]
        if auto_crop and crop_box is not None and crop_size is not None:
            out_img = output_image.resize(crop_size)
            pasted = human_img_orig.copy()
            pasted.paste(out_img, (crop_box[0], crop_box[1]))
            output_image = pasted

        return {
            "output_image": output_image,
            "mask_preview": mask_preview,
            "seed": actual_seed,
        }


_service_instance: Optional[TryonService] = None
_service_lock = threading.Lock()


def get_tryon_service() -> TryonService:
    global _service_instance
    if _service_instance is not None:
        return _service_instance

    with _service_lock:
        if _service_instance is None:
            _service_instance = TryonService()
    return _service_instance
