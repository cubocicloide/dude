# IaC runner image — the toolchain `dude iac *` runs inside.
#
# `dude iac` builds this image on first use and runs terraform / kubectl / helm /
# k9s inside it, so you don't have to install (or version-match) any of them on
# your machine. The image is tagged by a hash of THIS file: edit it (bump a
# version, add a tool) and the next `dude iac` command rebuilds automatically.
#
# Your AWS credentials are NOT baked in — `dude iac` mounts ~/.aws read-only at
# run time, so named profiles and SSO keep working. `dude iac login` runs on the
# host (it needs a browser); everything else runs in here.
#
# TARGETARCH is set automatically by Docker BuildKit (amd64 or arm64).

FROM debian:bookworm-slim
ARG TARGETARCH
ENV DEBIAN_FRONTEND=noninteractive

# Keep kubectl within ±1 minor of the EKS control plane (currently 1.36).
ARG TF_VERSION=1.10.5
ARG KUBECTL_VERSION=1.36.0
ARG HELM_VERSION=3.16.4
ARG K9S_VERSION=0.32.7

RUN apt-get update && apt-get install -y --no-install-recommends \
      curl unzip ca-certificates bash less groff git \
  && rm -rf /var/lib/apt/lists/*

# terraform
RUN curl -fsSL --retry 5 --retry-delay 2 --retry-connrefused \
      "https://releases.hashicorp.com/terraform/${TF_VERSION}/terraform_${TF_VERSION}_linux_${TARGETARCH}.zip" -o /tmp/tf.zip \
  && unzip -q /tmp/tf.zip -d /usr/local/bin && rm /tmp/tf.zip

# kubectl
RUN curl -fsSL --retry 5 --retry-delay 2 --retry-connrefused \
      "https://dl.k8s.io/release/v${KUBECTL_VERSION}/bin/linux/${TARGETARCH}/kubectl" -o /usr/local/bin/kubectl \
  && chmod +x /usr/local/bin/kubectl

# helm
RUN curl -fsSL --retry 5 --retry-delay 2 --retry-connrefused \
      "https://get.helm.sh/helm-v${HELM_VERSION}-linux-${TARGETARCH}.tar.gz" | tar xz -C /tmp \
  && mv /tmp/linux-${TARGETARCH}/helm /usr/local/bin/helm && rm -rf /tmp/linux-${TARGETARCH}

# k9s
RUN curl -fsSL --retry 5 --retry-delay 2 --retry-connrefused \
      "https://github.com/derailed/k9s/releases/download/v${K9S_VERSION}/k9s_Linux_${TARGETARCH}.tar.gz" | tar xz -C /usr/local/bin k9s

# aws cli v2 (arch naming differs: amd64 -> x86_64, arm64 -> aarch64)
RUN case "${TARGETARCH}" in amd64) A=x86_64;; arm64) A=aarch64;; *) A=${TARGETARCH};; esac \
  && curl -fsSL --retry 5 --retry-delay 2 --retry-connrefused \
      "https://awscli.amazonaws.com/awscli-exe-linux-${A}.zip" -o /tmp/aws.zip \
  && unzip -q /tmp/aws.zip -d /tmp && /tmp/aws/install && rm -rf /tmp/aws*

WORKDIR /work
