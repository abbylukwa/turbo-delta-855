FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies directly
RUN pip install --no-cache-dir qrcode[pil]==7.4.2 Pillow==10.0.0

# Create QR code generator script
RUN echo '#!/usr/bin/env python3\n\
import qrcode\n\
import argparse\n\
import sys\n\
\n\
def generate_qr(data, output_file="qrcode.png", version=1, box_size=10, border=4):\n\
    """Generate QR code from provided data"""\n\
    qr = qrcode.QRCode(\n\
        version=version,\n\
        error_correction=qrcode.constants.ERROR_CORRECT_L,\n\
        box_size=box_size,\n\
        border=border,\n\
    )\n\
    qr.add_data(data)\n\
    qr.make(fit=True)\n\
    \n\
    img = qr.make_image(fill_color="black", back_color="white")\n\
    img.save(output_file)\n\
    print(f"QR code saved as {output_file}")\n\
\n\
if __name__ == "__main__":\n\
    parser = argparse.ArgumentParser(description="Generate QR code")\n\
    parser.add_argument("data", help="Data to encode in QR code")\n\
    parser.add_argument("-o", "--output", default="qrcode.png", help="Output file name")\n\
    parser.add_argument("-v", "--version", type=int, default=1, help="QR code version")\n\
    parser.add_argument("-s", "--size", type=int, default=10, help="Box size")\n\
    parser.add_argument("-b", "--border", type=int, default=4, help="Border size")\n\
    \n\
    args = parser.parse_args()\n\
    \n\
    generate_qr(args.data, args.output, args.version, args.size, args.border)' > qr_generator.py

# Make the script executable
RUN chmod +x qr_generator.py

# Set default command
CMD ["python", "qr_generator.py", "--help"]
