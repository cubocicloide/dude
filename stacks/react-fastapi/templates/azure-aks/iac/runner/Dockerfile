# IaC runner image — the toolchain `dude iac *` runs inside.
#
# `dude iac` builds this image on first use and runs terraform / kubectl / helm /
# k9s inside it, so you don't have to install (or version-match) any of them on
# your machine. The image is tagged by a hash of THIS file: edit it (bump a
# version, add a tool) and the next `dude iac` command rebuilds automatically.
#
# Your Azure credentials are NOT baked in — `dude iac` mounts ~/.azure at run
# time, so `az login` on your machine carries into the container. That mount is
# read-WRITE on purpose: the Azure CLI rewrites its token cache whenever it
# refreshes an access token, and a read-only mount breaks authentication as soon
# as the cached token expires. `dude iac login` runs on the host (it needs a
# browser); everything else runs in here.
#
# TARGETARCH is set automatically by Docker BuildKit (amd64 or arm64).

FROM debian:bookworm-slim
ARG TARGETARCH
ENV DEBIAN_FRONTEND=noninteractive

# Keep kubectl within ±1 minor of the AKS control plane.
ARG TF_VERSION=1.10.5
ARG KUBECTL_VERSION=1.31.3
ARG HELM_VERSION=3.16.4
ARG K9S_VERSION=0.32.7

RUN apt-get update && apt-get install -y --no-install-recommends \
      curl unzip ca-certificates bash less git gnupg lsb-release \
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

# azure cli — installed from Microsoft's apt repository rather than pip, because
# the deb ships arm64 builds and keeps its own Python out of the way.
RUN install -m 0755 -d /etc/apt/keyrings \
  && curl -fsSL --retry 5 --retry-delay 2 --retry-connrefused https://packages.microsoft.com/keys/microsoft.asc \
      | gpg --dearmor -o /etc/apt/keyrings/microsoft.gpg \
  && chmod a+r /etc/apt/keyrings/microsoft.gpg \
  && echo "deb [arch=${TARGETARCH} signed-by=/etc/apt/keyrings/microsoft.gpg] https://packages.microsoft.com/repos/azure-cli/ $(lsb_release -cs) main" \
      > /etc/apt/sources.list.d/azure-cli.list \
  && apt-get update && apt-get install -y --no-install-recommends azure-cli \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /work
