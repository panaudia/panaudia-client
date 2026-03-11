
# Panaudia Space Hosting

There are three options for hosting Panaudia Spaces:

- Use our existing dev server for experimentation
- Host your own Panaudia Space server
- Use Panaudia Cloud to create hosted Spaces programmatically

Cloud and self-hosted Spaces are almost identical. Cloud Spaces support second-order ambisonics and higher participant capacity. Self-hosted Spaces support second to fifth-order ambisonics but have a lower maximum capacity.

These are the workflows for setting up each:

## Panaudia Cloud Dev Server

We maintain a free-to-use, shared dev server in Panaudia Cloud that you can use to test your applications without having to sign up.

**Request access** from support, and we will provide you with a Space ID and a key pair to create Tickets with.

## Panaudia Cloud

In the Panaudia Cloud web interface:

1. **Sign up** at [panaudia.com](https://panaudia.com/register)
2. **Create an Organisation** and add a Billing account
3. **Create a Project** and generate an API Key for it

In your application server:
4. **Create a public/private key pair** for signing tickets (see [Tickets](tickets.md))
5. **Create Spaces** using our API (see [Spaces API Guide](spaces-api-guide.md)) using your API Key and the public key from step 4


## Self Hosted Panaudia Space

You can self-host a Panaudia Space server, you will need a licence key from Panaudia Cloud. 
Panaudia Space is free for many non-commercial uses.

1. **Sign up** at [panaudia.com](https://panaudia.com/register)
2. **Download the latest release** of the Panaudia Space server from your Organisation's web page.
3. **Install and run the server** see [Panaudia Space](panaudia-space.md)


In your application server:

Tickets are optional for self-hosted Spaces. If you don't need to authenticate users, 
you can skip ticket creation steps 4 - 5 and connect directly to the Space without them.

4. **Create a public/private key pair** for signing tickets (see [Tickets](tickets.md))
5. **Add the public key to the Panaudia Space**  see [Panaudia Space](panaudia-space.md)
