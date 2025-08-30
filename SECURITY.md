# Security Policy

## Supported Versions

Use this section to tell people about which versions of your project are currently being supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability within FindDocs, please send an email to [your-email@example.com]. All security vulnerabilities will be promptly addressed.

Please do not publicly disclose the vulnerability until it has been addressed by the maintainers.

## Security Considerations

- **Local Processing**: This application is designed for local use and processes documents locally
- **No Cloud Storage**: Documents are stored in your browser's localStorage
- **Network Access**: Only localhost connections are used by default
- **Environment Variables**: Sensitive configuration should use environment variables
- **Docker Security**: Ensure Docker containers are properly secured in production environments

## Best Practices

1. **Keep Dependencies Updated**: Regularly update npm packages and Docker images
2. **Environment Variables**: Use `.env.local` for sensitive configuration
3. **Network Security**: Restrict access to required ports only
4. **File Permissions**: Ensure proper file permissions for uploaded documents
5. **Regular Audits**: Run security audits with `npm audit`

## Known Issues

None at this time.

## Disclosure Policy

When we receive a security bug report, we will:

1. Confirm the problem and determine affected versions
2. Audit code to find any similar problems
3. Prepare fixes for all supported versions
4. Release a new version and update the changelog
