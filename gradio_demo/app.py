import gradio as gr

from tryon_core import get_tryon_service, list_example_assets


example_assets = list_example_assets()
garm_list_path = [str(path) for path in example_assets["cloth"]]
human_list_path = [str(path) for path in example_assets["human"]]
human_ex_list = [
    {
        "background": path,
        "layers": None,
        "composite": None,
    }
    for path in human_list_path
]


def start_tryon(editor_value, garm_img, garment_des, is_checked, is_checked_crop, denoise_steps, seed):
    service = get_tryon_service()
    manual_mask = None
    if not is_checked and editor_value.get("layers"):
        manual_mask = editor_value["layers"][0]

    result = service.run(
        human_image=editor_value["background"],
        garment_image=garm_img,
        garment_description=garment_des,
        auto_mask=is_checked,
        auto_crop=is_checked_crop,
        denoise_steps=denoise_steps,
        seed=seed,
        manual_mask=manual_mask,
    )
    return result["output_image"], result["mask_preview"]

##default human


image_blocks = gr.Blocks().queue()
with image_blocks as demo:
    gr.Markdown("## IDM-VTON 👕👔👚")
    gr.Markdown("Virtual Try-on with your image and garment image. Check out the [source codes](https://github.com/yisol/IDM-VTON) and the [model](https://huggingface.co/yisol/IDM-VTON)")
    with gr.Row():
        with gr.Column():
            imgs = gr.ImageEditor(sources='upload', type="pil", label='Human. Mask with pen or use auto-masking', interactive=True)
            with gr.Row():
                is_checked = gr.Checkbox(label="Yes", info="Use auto-generated mask (Takes 5 seconds)",value=True)
            with gr.Row():
                is_checked_crop = gr.Checkbox(label="Yes", info="Use auto-crop & resizing",value=False)

            example = gr.Examples(
                inputs=imgs,
                examples_per_page=10,
                examples=human_ex_list
            )

        with gr.Column():
            garm_img = gr.Image(label="Garment", sources='upload', type="pil")
            with gr.Row(elem_id="prompt-container"):
                with gr.Row():
                    prompt = gr.Textbox(placeholder="Description of garment ex) Short Sleeve Round Neck T-shirts", show_label=False, elem_id="prompt")
            example = gr.Examples(
                inputs=garm_img,
                examples_per_page=8,
                examples=garm_list_path)
        with gr.Column():
            # image_out = gr.Image(label="Output", elem_id="output-img", height=400)
            masked_img = gr.Image(label="Masked image output", elem_id="masked-img",show_share_button=False)
        with gr.Column():
            # image_out = gr.Image(label="Output", elem_id="output-img", height=400)
            image_out = gr.Image(label="Output", elem_id="output-img",show_share_button=False)




    with gr.Column():
        try_button = gr.Button(value="Try-on")
        with gr.Accordion(label="Advanced Settings", open=False):
            with gr.Row():
                denoise_steps = gr.Number(label="Denoising Steps", minimum=20, maximum=40, value=30, step=1)
                seed = gr.Number(label="Seed", minimum=-1, maximum=2147483647, step=1, value=42)



    try_button.click(fn=start_tryon, inputs=[imgs, garm_img, prompt, is_checked,is_checked_crop, denoise_steps, seed], outputs=[image_out,masked_img], api_name='tryon')

            


image_blocks.launch()

