/** @type {import('next').NextConfig} */
const nextConfig = {
  // These packages use native bindings / dynamic requires (ONNX runtime,
  // sharp) and must run as real Node modules rather than be bundled.
  serverExternalPackages: ['@xenova/transformers', 'sharp', 'onnxruntime-node', 'pdf-parse'],
};

export default nextConfig;
