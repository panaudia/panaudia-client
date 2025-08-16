# Panaudia Dockerfile for building an arm64 docker image

Download the latest arm64 precompiled binary from https://panaudia.com and unzip the tar file into this folder.

Then build the image (you will probably want to change the name `panaudia/panaudia-space` to a name of your own)

```
docker buildx build --platform linux/arm64/v8 --no-cache -t panaudia/panaudia-space:latest-arm64 .
```


