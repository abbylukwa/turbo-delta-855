FROM python:3.11-alpine

# Install required packages
RUN apk add --no-cache python3 py3-pip
RUN pip install --no-cache-dir qrcode

# Create the QR code script using printf to handle newlines properly
RUN printf '#!/usr/bin/env python3\n\
import qrcode\n\
import sys\n\
\ndef main():\n\
    if len(sys.argv) < 2:\n\
        print("Usage: qr-cli <text> [output_file]")\n\
        print("Example: qr-cli \\\"Hello World\\\" output.png")\n\
        print("If no output file is provided, shows QR in terminal")\n\
        sys.exit(1)\n\
    \n\
    text = sys.argv[1]\n\
    output_file = sys.argv[2] if len(sys.argv) > 2 else None\n\
    \n\
    # Create QR code\n\
    qr = qrcode.QRCode(\n\
        version=1,\n\
        error_correction=qrcode.constants.ERROR_CORRECT_L,\n\
        box_size=10,\n\
        border=4,\n\
    )\n\
    qr.add_data(text)\n\
    qr.make(fit=True)\n\
    \n\
    if output_file:\n\
        # Save to file\n\
        img = qr.make_image(fill_color="black", back_color="white")\n\
        img.save(output_file)\n\
        print(f"QR code saved to: {output_file}")\n\
    else:\n\
        # Show in terminal\n\
        qr.print_ascii()\n\
\n\
if __name__ == "__main__":\n\
    main()\n' > /usr/local/bin/qr-cli

# Make the script executable
RUN chmod +x /usr/local/bin/qr-cli

# Set default command
ENTRYPOINT ["/usr/local/bin/qr-cli"]
CMD ["--help"]
