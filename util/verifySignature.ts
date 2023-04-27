import { Request } from "express";
import { createHmac, timingSafeEqual } from "crypto";

export default function verifySignature(req: Request, secret: string) {
    // Presumed constants
    const sigHeaderName = "X-Hub-Signature-256";
    const sigHashAlg = "sha256";

    const data = JSON.stringify(req.body);
    const sig = Buffer.from(req.get(sigHeaderName) || "", "utf8");
    const hmac = createHmac(sigHashAlg, secret);
    const digest = Buffer.from(`${sigHashAlg}=${hmac.update(data).digest("hex")}`, "utf8");

    // Compare
    if (sig.length !== digest.length || !timingSafeEqual(digest, sig)) {
        return false; // Could not verify
    }
    return true; // Verified
}
