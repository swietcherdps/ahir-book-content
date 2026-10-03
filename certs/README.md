# Source TLS chain

The source website sends only its leaf certificate (issuer: Let's Encrypt YR2). Linux curl cannot verify it without the omitted intermediates. Certificate verification remains enabled.

These public certificates were obtained from the official Let's Encrypt certificate directory:

- `int-yr2.pem`: https://letsencrypt.org/certs/gen-y/int-yr2.pem
- `root-yr-by-x1.pem`: https://letsencrypt.org/certs/gen-y/root-yr-by-x1.pem

The workflow verifies YR2 using the cross-signed Root YR and the runner's existing system CA store, then adds the verified intermediate chain to a temporary curl CA bundle. It does not install a new trust root or modify the runner's system certificate store. The source leaf hostname and certificate chain were also verified locally with OpenSSL.

Official chain documentation: https://letsencrypt.org/certificates/
