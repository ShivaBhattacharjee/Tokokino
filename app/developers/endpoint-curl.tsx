import { CodeSample } from "./code-sample"
import { curlForEndpoint } from "./curl-samples"

export function EndpointCurl({
  method,
  path,
}: {
  method: string
  path: string
}) {
  return (
    <CodeSample
      className="mt-3"
      filename="request.sh"
      code={curlForEndpoint(method, path)}
    />
  )
}
