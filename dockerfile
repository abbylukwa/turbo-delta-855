FROM python:3.11-alpine

# Install required packages
RUN apk add --no-cache python3 py3-pip
RUN pip install --no-cache-dir qrcode

# Create the QR code script using a here-document to avoid escape issues
RUN cat > /usr/local/bin/qr-cli << 'EOF'
#!/usr/bin/env python3
import qrcode
import sys

def main():
    if len(sys.argv) < 2:
        print("Usage: qr-cli <text> [output_file]")
        print('Example: qr-cli "Hello World" output.png')
        print("If no output file is provided, shows QR in terminal")
        sys.exit(1)
    
    text = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    
    # Create QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(text)
    qr.make(fit=True)
    
    if output_file:
        # Save to file
        img = qr.make_image(fill_color="black", back_color="white")
        img.save(output_file)
        print(f"QR code saved to: {output_file}")
    else:
        # Show in terminal
        qr.print_ascii()

if __name__ == "__main__":
    main()
EOF

# Make the script executable
RUN chmod +x /usr/local/bin/qr-cli

# Set default command
ENTRYPOINT ["/usr/local/bin/qr-cli"]
CMD ["--help"]
