/** Ask Cloudinary for a smaller, optimised copy (auto format + quality). Other URLs are returned unchanged. */
export function cdn(url: string | null | undefined, w = 400): string | undefined {
  if (!url) return undefined;
  return url.includes("res.cloudinary.com") && url.includes("/upload/")
    ? url.replace("/upload/", `/upload/c_limit,w_${w},q_auto,f_auto/`) : url;
}
