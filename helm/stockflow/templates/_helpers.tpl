{{- define "stockflow.labels" -}}
app.kubernetes.io/part-of: stockflow
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end }}

{{/* Selector labels must never change after install, so they only use name + release. */}}
{{- define "stockflow.selector" -}}
app.kubernetes.io/name: {{ .component }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
{{- end }}
