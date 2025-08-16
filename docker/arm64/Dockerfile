FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates libopus0 libopusfile0 \
    liblapack3 libopenblas0-serial libopenblas0 liblapacke libcap2-bin

RUN adduser \
  --disabled-password \
  --gecos "" \
  --home "/nonexistent" \
  --shell "/sbin/nologin" \
  --no-create-home \
  --uid 65532 \
  small-user

RUN mkdir -p /opt/panaudia/bin

COPY panaudia-space-arm64/panaudia-space /opt/panaudia/bin/panaudia-space
RUN chmod 755 /opt/panaudia/bin/panaudia-space
COPY panaudia-space-arm64/third-party-licences.md /opt/panaudia/third-party-licences.md
COPY panaudia-space-arm64/panaudia-space-free-licence.md /opt/panaudia/panaudia-space-free-licence.md

ENV LD_LIBRARY_PATH=/usr/local/lib;/usr/lib

## this allows panaudia to listen on restricted ports if desired
RUN setcap CAP_NET_BIND_SERVICE=+eip /opt/panaudia/bin/panaudia-space
RUN touch /etc/ld.so.conf.d/panaudia-space.conf
RUN echo "/usr/local/lib/ /usr/lib/" > /etc/ld.so.conf.d/panaudia-space.conf
RUN ldconfig

USER small-user:small-user

WORKDIR /opt/panaudia/bin