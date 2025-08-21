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

# Create a CLI QR code generator script
RUN echo '#!/usr/bin/env python3\n\
import qrcode\n\
import argparse\n\
import sys\n\
import os\n\
\n\
def generate_qr(data, output_file=None, version=1, box_size=10, border=4, show_in_terminal=False):\n\
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
    if output_file:\n\
        img = qr.make_image(fill_color="black", back_color="white")\n\
        img.save(output_file)\n\
        print(f"QR code saved as {output_file}")\n\
    \n\
    if show_in_terminal:\n\
        # Create ASCII representation for terminal\n\
        qr.print_ascii()\n\
    elif not output_file and not show_in_terminal:\n\
        # Default: show in terminal if no output file specified\n\
        qr.print_ascii()\n\
\n\
def main():\n\
    parser = argparse.ArgumentParser(description="Generate QR code from command line")\n\
    parser.add_argument("data", nargs="?", help="Data to encode in QR code")\n\
    parser.add_argument("-o", "--output", help="Output file name (e.g., qrcode.png)")\n\
    parser.add_argument("-v", "--version", type=int, default=1, help="QR code version (1-40)")\n\
    parser.add_argument("-s", "--size", type=int, default=10, help="Box size (pixels per module)")\n\
    parser.add_argument("-b", "--border", type=int, default=4, help="Border size (modules)")\n\
    parser.add_argument("-t", "--terminal", action="store_true", help="Display QR code in terminal only")\n\
    parser.add_argument("-i", "--interactive", action="store_true", help="Interactive mode")\n\
    \n\
    args = parser.parse_args()\n\
    \n\
    if args.interactive:\n\
        # Interactive mode\n\
        print("=== QR Code Generator Interactive Mode ===")\n\
        data = input("Enter text/URL to encode: ").strip()\n\
        if not data:\n\
            print("No data provided. Exiting.")\n\
            return\n\
        \n\
        output_choice = input("Save to file? (y/N): ").strip().lower()\n\
        output_file = None\n\
        if output_choice in ["y", "yes"]:\n\
            output_file = input("Output filename (default: qrcode.png): ").strip()\n\
            if not output_file:\n\
                output_file = "qrcode.png"\n\
        \n\
        show_terminal = input("Display in terminal? (Y/n): ").strip().lower()\n\
        show_terminal = show_terminal not in ["n", "no"]\n\
        \n\
        generate_qr(data, output_file, args.version, args.size, args.border, show_terminal)\n\
    \n\
    elif args.data:\n\
        # Command-line mode\n\
        generate_qr(args.data, args.output, args.version, args.size, args.border, args.terminal)\n\
    \n\
    else:\n\
        # Show help if no arguments provided\n\
        parser.print_help()\n\
        print("\\nExamples:")\n\
        print("  qr-cli \"Hello World\" -t                 # Display in terminal")\n\
        print("  qr-cli \"https://example.com\" -o qr.png  # Save to file")\n\
        print("  qr-cli -i                               # Interactive mode")\n\
\n\
if __name__ == "__main__":\n\
    main()' > /usr/local/bin/qr-cli

# Make the script executable and available system-wide
RUN chmod +x /usr/local/bin/qr-cli

# Set default command to show help
CMD ["qr-cli", "--help"]
