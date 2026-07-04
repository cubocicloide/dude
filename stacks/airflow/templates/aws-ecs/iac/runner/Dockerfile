# IaC runner image — the toolchain `dude iac *` runs inside.
#
# `dude iac` builds this image on first use and runs terraform inside it, so you
# don't have to install (or version-match) it on your machine. The image is
# tagged by a hash of THIS file: edit it (bump a version, add a tool) and the
# next `dude iac` command rebuilds automatically.
#
# Your AWS credentials are NOT baked in — `dude iac` mounts ~/.aws read-only at
# run time, so named profiles and SSO keep working. `dude iac login` and the
# aws/docker calls run on the host; terraform runs in here.
#
# TARGETARCH is set automatically by Docker BuildKit (amd64 or arm64).

FROM debian:bookworm-slim
ARG TARGETARCH
ENV DEBIAN_FRONTEND=noninteractive

ARG TF_VERSION=1.10.5

RUN apt-get update && apt-get install -y --no-install-recommends \
      curl unzip ca-certificates bash less groff git \
  && rm -rf /var/lib/apt/lists/*

# terraform
RUN curl -fsSL --retry 5 --retry-delay 2 --retry-connrefused \
      "https://releases.hashicorp.com/terraform/${TF_VERSION}/terraform_${TF_VERSION}_linux_${TARGETARCH}.zip" -o /tmp/tf.zip \
  && unzip -q /tmp/tf.zip -d /usr/local/bin && rm /tmp/tf.zip

# aws cli v2 (arch naming differs: amd64 -> x86_64, arm64 -> aarch64)
RUN case "${TARGETARCH}" in amd64) A=x86_64;; arm64) A=aarch64;; *) A=${TARGETARCH};; esac \
  && curl -fsSL --retry 5 --retry-delay 2 --retry-connrefused \
      "https://awscli.amazonaws.com/awscli-exe-linux-${A}.zip" -o /tmp/aws.zip \
  && unzip -q /tmp/aws.zip -d /tmp && /tmp/aws/install && rm -rf /tmp/aws*

WORKDIR /work
