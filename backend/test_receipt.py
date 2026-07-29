import sys
from pathlib import Path
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont

W = 640
PAD = 36
BRAND = (22, 163, 74)

img = Image.new("RGB", (W, 400), "white")
d = ImageDraw.Draw(img)
y = PAD + 10

logo_path = Path("../bblogo.png")
if logo_path.exists():
    print("Logo exists!")
    logo = Image.open(logo_path).convert("RGBA")
    lw, lh = logo.size
    logo_h = 70
    logo_w = int(lw * (logo_h / lh))
    logo = logo.resize((logo_w, logo_h), Image.LANCZOS)
    img.paste(logo, (W // 2 - logo_w // 2, y), logo)
    y += logo_h + 15
else:
    print("Logo not found!")
img.save("test.png")
print("Saved test.png")
