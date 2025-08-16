FROM debian:bookworm-slim AS builder

RUN apt-get update && apt-get install -y build-essential git wget gpg cmake scons \
    ragel gengetopt libuv1-dev libunwind-dev libspeexdsp-dev libssl-dev

RUN mkdir -m 700 /root/.ssh; \
  touch -m 600 /root/.ssh/known_hosts; \
  ssh-keyscan github.com > /root/.ssh/known_hosts

WORKDIR /opt/panaudia

RUN git clone --depth 1 https://github.com/paulharter/openfec.git
RUN git clone --branch without-staircase --depth 1 https://github.com/paulharter/roc-toolkit.git

WORKDIR /opt/panaudia/openfec

RUN mkdir build
WORKDIR /opt/panaudia/openfec/build
RUN cmake .. -DDEBUG:STRING=OFF -DOF_USE_LDPC_STAIRCASE_CODEC=OFF
RUN make
RUN make install

WORKDIR /opt/panaudia/roc-toolkit

RUN scons -Q --with-openfec-includes=../../openfec/src \
        --with-includes=/opt/panaudia/openfec/src/lib_common \
        --with-libraries=/opt/panaudia/openfec/bin/Release \
        --disable-sox \
        --disable-pulseaudio \
        --disable-sndfile \
        PKG_CONFIG=`brew --prefix`/bin/pkg-config

RUN scons -Q --with-openfec-includes=../../openfec/src \
        --with-includes=/opt/panaudia/openfec/src/lib_common \
        --with-libraries=/opt/panaudia/openfec/bin/Release \
        --disable-sox \
        --disable-pulseaudio \
        --disable-sndfile \
        PKG_CONFIG=`brew --prefix`/bin/pkg-config install


FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates libopus0 libopusfile0 libuv1 libunwind8 libspeexdsp1 \
    liblapack3 libopenblas0-serial libopenblas0 liblapacke libcap2-bin

COPY --from=builder /usr/lib/libroc.so /usr/lib/libroc.so
COPY --from=builder /usr/lib/libroc.so.0 /usr/lib/libroc.so.0
COPY --from=builder /usr/lib/libroc.so.0.4 /usr/lib/libroc.so.0.4

COPY --from=builder /usr/local/lib/libopenfec.so /usr/local/lib/libopenfec.so
COPY --from=builder /usr/local/lib/libopenfec.so.1 /usr/local/lib/libopenfec.so.1
COPY --from=builder /usr/local/lib/libopenfec.so.1.4.2 /usr/local/lib/libopenfec.so.1.4.2

RUN adduser \
  --disabled-password \
  --gecos "" \
  --home "/nonexistent" \
  --shell "/sbin/nologin" \
  --no-create-home \
  --uid 65532 \
  small-user

RUN mkdir -p /opt/panaudia/bin

COPY panaudia-space-arm64-link/panaudia-space /opt/panaudia/bin/panaudia-space
RUN chmod 755 /opt/panaudia/bin/panaudia-space
COPY panaudia-space-arm64-link/third-party-licences.md /opt/panaudia/third-party-licences.md
COPY panaudia-space-arm64-link/panaudia-space-free-licence.md /opt/panaudia/panaudia-space-free-licence.md

ENV LD_LIBRARY_PATH=/usr/local/lib;/usr/lib

## this allows panaudia to listen on restricted ports if desired
RUN setcap CAP_NET_BIND_SERVICE=+eip /opt/panaudia/bin/panaudia-space
RUN touch /etc/ld.so.conf.d/panaudia-space.conf
RUN echo "/usr/local/lib/ /usr/lib/" > /etc/ld.so.conf.d/panaudia-space.conf
RUN ldconfig

USER small-user:small-user

WORKDIR /opt/panaudia/bin