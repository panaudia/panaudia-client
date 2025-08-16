# Panaudia Dockerfile for building an amd64 docker image with Panaudia Link enabled

Download the latest amd64-link precompiled binary from https://panaudia.com and unzip the tar file into this folder.

Then build the image (you will probably want to change the name `panaudia/panaudia-space` to a name of your own)

```
docker buildx build --platform linux/amd64 --no-cache -t panaudia/panaudia-space:latest-amd64-link .
```


