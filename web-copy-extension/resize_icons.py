import os
from PIL import Image

def resize_icon(input_path, sizes):
    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found.")
        return

    try:
        img = Image.open(input_path)
        for size in sizes:
            output_path = f"icon{size}.png"
            resized_img = img.resize((size, size), Image.Resampling.LANCZOS)
            resized_img.save(output_path)
            print(f"Created {output_path}")
    except Exception as e:
        print(f"Error resizing image: {e}")

if __name__ == "__main__":
    resize_icon("icon.png", [16, 48, 128])
