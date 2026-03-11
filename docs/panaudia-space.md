# Panaudia Space

Panaudia Space is a spatial audio engine.

Users can connect from virtual worlds in browsers and get back spatialised binaural stereo mixes.

The functionality of this stand-alone Panaudia Space server is almost identical to a Panaudia Cloud Space. The chief differences being that it has lower maximum user capacity but can do higher order ambisonics.

## Quick Start using Docker

Download your licence and a chosen binary from your organisation's page.

Select a matching Dockerfile from [here](https://github.com/panaudia/panaudia-client/tree/main/docker).

Unzip the binary next to the Dockerfile.

Build the docker image:

```
docker buildx build --platform linux/amd64 --no-cache \
    -t panaudia/panaudia-space:latest-amd64 .
```

Run the container adding in your licence file:

```
docker run --rm -it --network=host -e PANAUDIA_LOG_LEVEL=1 \
    -v ${PWD}/panaudia-licence.txt:/opt/panaudia/bin/panaudia-licence.txt \
    panaudia/panaudia-space:latest-amd64 /opt/panaudia/bin/panaudia-space
```

## Licensing

We offer two types of licence for Panaudia Space, a free licence that can be used for certain non-commercial uses, and commercial licences for large and small businesses.

You can request a free licence directly from an organisation's web page: create an Organisation, click on the Software tab and select Panaudia Space.

Contact Paul — paul@glowinthedark.co.uk to arrange a commercial licence.

You will need to download a licence file to unlock the software.

## Download

You can download the Panaudia Space software directly from an organisation's web page.

We offer two separate builds for each version of Panaudia Space, one for arm64 and one for amd64 chip architectures.

## Install

Panaudia Space runs on Linux, we currently recommend Debian bookworm as that's what we are building and testing with.

The tar file you have downloaded contains a binary executable and copies of its licence terms and copyright notices.

### Building container images with our Dockerfiles

If you plan to deploy using containers we have some [Dockerfiles](https://github.com/panaudia/panaudia-client/tree/main/docker) to make this easy.

Each build flavour has a matching Dockerfile, just unzip the tar next to the Dockerfile and run docker build. There are more detailed instructions with the Dockerfiles.

### Installing by hand

If you don't plan to use containers or want to install manually it's quite simple, and you might still want to use the Dockerfiles for reference.

First copy the binary into /opt/panaudia/bin:

```
mkdir -p /opt/panaudia/bin
cp panaudia-space /opt/panaudia/bin/panaudia-space
```

And make sure it's executable:

```
chmod 755 /opt/panaudia/bin/panaudia-space
```

Then install its dependencies, these are principally libopus and liblapack. Also install libcap2-bin if you want to listen on restricted ports:

```
apt-get update && apt-get install -y ca-certificates libopus0 libopusfile0 \
    liblapack3 libopenblas0-serial libopenblas0 liblapacke libcap2-bin
```

You may need to set the environment to specify where it should look for dynamic libraries:

```
LD_LIBRARY_PATH=/usr/local/lib;/usr/lib
```

And if you do want to listen on restricted ports you can use setcap like this:

```
setcap CAP_NET_BIND_SERVICE=+eip /opt/panaudia/bin/panaudia-space
touch /etc/ld.so.conf.d/panaudia-space.conf
echo "/usr/local/lib/ /usr/lib/" > /etc/ld.so.conf.d/panaudia-space.conf
ldconfig
```

You should now be able to run the binary:

```
/opt/panaudia/bin/panaudia-space
```

## Usage

### Licence File

To run Panaudia Space you need to agree to the Panaudia Space Free Licence Terms or have a separate commercial licence. In either case you should have a licence file which is needed to unlock the application.

There are two ways to use this file with Panaudia Space:

- Set the environment variable `PANAUDIA_LICENCE_PATH` to the file's path.
- Copy the file's contents into the environment variable `PANAUDIA_LICENCE_STRING`.

The default for `PANAUDIA_LICENCE_PATH` is `panaudia-licence.txt` so if you place this file next to the binary it will work fine.

### Configuration

All configuration of the application is done by setting environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PANAUDIA_HOST` | The address the server will bind to. | `0.0.0.0` |
| `PANAUDIA_PUBLIC_HOST` | Use this to force the address used by WebRTC rather than that discovered by ICE. | Optional |
| `PANAUDIA_HTTP_PORT` | The port used by the websockets server that negotiates WebRTC. | `8080` |
| `PANAUDIA_RTC_PORT` | The port used for WebRTC audio. | `8443` |
| `PANAUDIA_TLS_CTR_PATH` | The file path to a TLS certificate for serving wss. | Optional |
| `PANAUDIA_TLS_KEY_PATH` | The file path to a TLS key for serving wss. | Optional |
| `PANAUDIA_TICKET_KEY_PATH` | The file path to a key if you want to use secure tickets. See the [Tickets documentation](tickets.md). | Optional |
| `PANAUDIA_SPACE_SIZE` | The size of the space in meters. | `40` |
| `PANAUDIA_SPACE_ORDER` | The ambisonic order of the Space. If you are using Panaudia Link output it can only be 2 or 3, otherwise it can go up to 5. | `3` |
| `PANAUDIA_LOG_MS` | Turns on regular logging of performance in ms. 0 or 1. | `0` |
| `PANAUDIA_TEST_TONE` | Turns on a test tone. 0 or 1. | `0` |
| `PANAUDIA_LOG_LEVEL` | Sets logging level: 0=VERBOSE, 1=DEBUG, 2=INFO, 3=WARNING, 4=ERROR, 5=CRITICAL. | `INFO` |
| `PANAUDIA_LICENCE_PATH` | The path to the licence file. Set to empty string to use `PANAUDIA_LICENCE_STRING` instead. | `panaudia-licence.txt` |
| `PANAUDIA_LICENCE_STRING` | Copy the contents of the licence file in here to avoid using a file. | Optional |
