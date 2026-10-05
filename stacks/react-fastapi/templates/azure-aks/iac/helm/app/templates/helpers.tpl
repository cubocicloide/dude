{{/*
Chart helpers. This file is named without a leading underscore on purpose: the
dude template scaffolder renames `_*` files to `.*`, and Helm ignores files
starting with `.`. The `define` blocks below are still loaded normally and this
file emits no manifests.
*/}}

{{- define "app.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "app.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "app.selectorLabels" -}}
app.kubernetes.io/name: {{ include "app.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "app.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{ include "app.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
{{- end -}}

{{- define "app.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "app.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{- define "app.redisUrl" -}}
redis://{{ include "app.fullname" . }}-redis:{{ .Values.redis.port }}/0
{{- end -}}

{{- define "app.backendImage" -}}
{{- if .Values.image.registry -}}{{ .Values.image.registry }}/{{ end -}}{{ .Values.image.backend.repository }}:{{ .Values.image.backend.tag }}
{{- end -}}

{{- define "app.frontendImage" -}}
{{- if .Values.image.registry -}}{{ .Values.image.registry }}/{{ end -}}{{ .Values.image.frontend.repository }}:{{ .Values.image.frontend.tag }}
{{- end -}}

{{/*
Every app container (backend, Celery worker/beat, Flower) loads its full
environment from the ConfigMap (non-sensitive config + the in-cluster Redis URLs)
and the Secret (sensitive values). Adding a variable is therefore just a new key
under `.Values.config` / `.Values.secrets` plus the matching field in
backend/app/core/config.py — no chart edit needed. The secretRef is optional so
deployments without any secret still start.
*/}}
{{- define "app.envFrom" -}}
- configMapRef:
    name: {{ include "app.fullname" . }}-config
- secretRef:
    name: {{ include "app.fullname" . }}-secret
    optional: true
{{- end -}}

{{- define "app.ingressPaths" -}}
- path: /api
  pathType: Prefix
  backend:
    service:
      name: {{ include "app.fullname" . }}-backend
      port:
        number: {{ .Values.backend.port }}
- path: /
  pathType: Prefix
  backend:
    service:
      name: {{ include "app.fullname" . }}-frontend
      port:
        number: {{ .Values.frontend.port }}
{{- end -}}
