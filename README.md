# Xenium Designs

Premium dashboards for modern businesses.

## Development

Static HTML/CSS site deployed via GitHub Actions → FTP.

### Local Development

Just open `index.html` in a browser.

### Deployment

Push to `main` branch triggers automatic FTP deployment.

GitHub Secrets needed:
- `FTP_SERVER` — `ftp.xeniumdesigns.com`
- `FTP_USERNAME` — FTP username
- `FTP_PASSWORD` — FTP password
