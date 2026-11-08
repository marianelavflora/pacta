import { describe, expect, it } from "vitest";

import nextConfig from "@/next.config";
import { clientUrl, freelancerUrl } from "@/lib/routes";

// Las vistas se llamaban /a/<id> y /f/<id>; ahora son /cliente/<id> y /freelancer/<id>.
// Los links viejos ya compartidos tienen que seguir andando (redirigen a los nuevos).

describe("links viejos de las vistas del acuerdo", () => {
  it("/a/<id> redirige a /cliente/<id> y /f/<id> a /freelancer/<id>", async () => {
    const redirects = await nextConfig.redirects!();
    expect(redirects).toEqual([
      { source: "/a/:id", destination: "/cliente/:id", permanent: true },
      { source: "/f/:id", destination: "/freelancer/:id", permanent: true },
    ]);
  });

  it("los links nuevos usan nombres que se entienden", () => {
    expect(clientUrl("abc123")).toBe("/cliente/abc123");
    expect(freelancerUrl("abc123")).toBe("/freelancer/abc123");
  });
});
