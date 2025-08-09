"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, Button, Link as HeroUILink, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Input } from "@heroui/react";
import { Copy, ExternalLink } from "lucide-react";
import { addToast } from "@heroui/toast";
import { FiLink } from "react-icons/fi";
import { FaFacebookF, FaTwitter } from "react-icons/fa";
import { updateReferralCodeForCurrentUser } from "@/lib/auth";

interface ReferralCardProps {
  referralCode: string;
}

export function ReferralCard({ referralCode }: ReferralCardProps) {
  const referralUrl = `https://try.virtualxposure.com/pages/order?ref=${referralCode}`;
  const [isOpen, setIsOpen] = useState(false);
  const [token, setToken] = useState(referralCode || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(referralCode || "");
  }, [referralCode]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      addToast({
        title: "Referral link copied to clipboard!",
        color: "success",
      });
    } catch (error) {
      addToast({
        title: "Failed to copy link",
        color: "danger",
      });
    }
  };

  const shareOnTwitter = () => {
    const text = "Check out this amazing platform!";
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(referralUrl)}`;
    window.open(url, "_blank");
  };

  const shareOnFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralUrl)}`;
    window.open(url, "_blank");
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardBody className="p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">
          Your Referral Link (Share This)
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          This is <strong>your unique link</strong> to track your signups &{" "}
          <u>earn prizes.</u>
          <br />
          <br />
          Send this to your email list, slack group, communities, message your
          friends, post on social media, etc.
        </p>

        <div className="flex flex-col md:flex-row items-center gap-2 p-3 bg-gray-100 rounded-lg mb-4">
          <HeroUILink
            isExternal
            // showAnchorIcon
            // anchorIcon={<FiLink size={16} />}
            underline="hover"
            href={referralUrl}
            target="_blank"
            className="flex-1 w-full text-sm text-primary font-medium truncate"
          >
            <FiLink size={16} className="mr-2" />
            {referralUrl.toLowerCase()}
          </HeroUILink>
          <div className="flex gap-2">
            <Button
              color="primary"
              variant="solid"
              isIconOnly
              onPress={copyToClipboard}
              aria-label="Copy Link"
            >
              <Copy size={16} />
            </Button>

            <Button
              color="default"
              variant="bordered"
              isIconOnly
              onPress={shareOnTwitter}
              aria-label="Share on Twitter"
            >
              <FaTwitter size={16} />
            </Button>

            <Button
              color="default"
              variant="bordered"
              isIconOnly
              onPress={shareOnFacebook}
              aria-label="Share on Facebook"
            >
              <FaFacebookF size={16} />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div />
          <Button size="sm" variant="bordered" onPress={() => setIsOpen(true)}>
            Customize Token
          </Button>
        </div>
      </CardBody>

      <Modal isOpen={isOpen} onOpenChange={setIsOpen}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">Customize token</ModalHeader>
              <ModalBody>
                <div className="text-sm text-gray-600">Referral ID/Token</div>
                <Input
                  value={token}
                  onValueChange={(v) => { setToken(v); setError(null); }}
                  variant="bordered"
                  placeholder="your-token"
                />
                <div className="flex items-start gap-2 text-warning-500 text-xs">
                  <span>Note that changing the referral token will invalidate any already shared links.</span>
                </div>
                {error && (<div className="text-danger-500 text-xs">{error}</div>)}
              </ModalBody>
              <ModalFooter>
                <Button variant="bordered" onPress={onClose}>Cancel</Button>
                <Button color="primary" isLoading={saving} onPress={async () => {
                  setSaving(true);
                  try {
                    const res = await fetch('/api/me/referrer-token', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ token })
                    });
                    const json = await res.json();
                    if (!res.ok || !json?.success) {
                      const msg = json?.error || 'Failed to update token';
                      setError(msg);
                      addToast({ title: msg, color: 'danger' });
                      setSaving(false);
                      return;
                    }
                    addToast({ title: 'Token updated', color: 'success' });
                    setSaving(false);
                    onClose();
                  } catch (e) {
                    setSaving(false);
                    setError('Failed to update token');
                    addToast({ title: 'Failed to update token', color: 'danger' });
                  }
                }}>Save</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </Card>
  );
}
