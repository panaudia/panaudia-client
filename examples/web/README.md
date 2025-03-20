# Panaudia Web Example

This is a very simple example of a web server connecting to a Panaudia Space.
It is based on the Town Square example on our website.
Mostly this example is just static html and js, but it also has a simple Flask web app to serve it and generate Tickets.

### Install

Install Python and set up your environment. If you're new to python see [Python download](https://wiki.python.org/moin/BeginnersGuide/Download)

Download this repo:

```
git clone git@github.com:panaudia/panaudia-client.git
```

Install the dependencies for a simple flask web server in `requirements.txt`

```
cd panaudia-client/examples/web
pip install -r requirements.txt
```

### Config

There is a file called `config.py`, this holds the ID for a Panaudia Space and the authority name that will be used to sign keys:

```python
SPACE_ID = "space_0b76c074-b21b-4fc9-aee5-e1a5de4b7c6f"
AUTHORITY = "dev.panaudia.com"
```

By default the space is our shared development server and the name is just us, you can change this if you set up a different Space to use. 
The authority name can be anything, you can leave it as it is, or change it to an identifier of your choice.

You will also need a public/private key pair to sign tickets with. 
When you first run the server it will create a default pair that you can use with your own Spaces, 
or you can get in touch, and we will let you have the keys for the shared development Space.
These keys live in:

```
/keys/panaudia_key
/keys/panaudia_key.pub
```

### Run

This will run the server:

```python main.py```










