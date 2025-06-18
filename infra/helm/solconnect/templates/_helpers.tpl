{{- define "solconnect.name" -}}
solconnect-relay
{{- end -}}

{{- define "solconnect.fullname" -}}
{{ include "solconnect.name" . }}
{{- end -}}
