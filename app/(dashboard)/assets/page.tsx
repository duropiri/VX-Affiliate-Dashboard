"use client";

import { useState, useEffect } from "react";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Image,
  Input,
  Spinner,
} from "@heroui/react";
import { Search, Link, ExternalLink } from "lucide-react";
import { FiLink } from "react-icons/fi";
import { getAssets, Asset } from "@/lib/auth";

export default function AssetsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load assets from database
  useEffect(() => {
    const loadAssets = async () => {
      try {
        console.log("🔄 Loading assets from server API...");
        const res = await fetch("/api/me/assets", { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        const assetsData = json?.assets || [];
        console.log("✅ Assets loaded:", assetsData);
        setAssets(assetsData);
      } catch (err) {
        console.error("❌ Error loading assets:", err);
        setError("Failed to load assets");
      } finally {
        setLoading(false);
      }
    };

    loadAssets();
  }, []);

  // Filter assets based on search term
  const filteredAssets = assets.filter((asset) => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    const title = asset.title.toLowerCase();
    const url = asset.url.toLowerCase();
    const description = asset.description?.toLowerCase() || "";
    const category = asset.category?.toLowerCase() || "";

    return (
      title.includes(searchLower) ||
      url.includes(searchLower) ||
      description.includes(searchLower) ||
      category.includes(searchLower)
    );
  });

  const handleCardClick = (url: string) => {
    window.open(url, "_blank");
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner
          classNames={{ label: "text-foreground mt-4" }}
          variant="default"
          size="lg"
        />
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-8">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">Assets</h1>
          </div>
          <div className="text-center py-12">
            <div className="text-gray-500">
              <FiLink size={48} className="mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Error Loading Assets
              </h3>
              <p className="text-gray-600">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        {/* Page Title */}
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">Assets</h1>
        </div>
        {/* Search Bar */}
        <div className="flex justify-between items-center">
          <Input
            placeholder="Search assets..."
            startContent={<Search size={16} />}
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="max-w-xs"
          />
        </div>
        {/* Assets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssets.length > 0 ? (
            filteredAssets.map((asset) => (
              <Card
                key={asset.id}
                className="relative w-full rounded-xl hover:shadow-xl group/asset bg-white hover:outline hover:outline-primary"
                // isPressable
                // onPress={() => handleCardClick(asset.url)}
              >
                <CardBody className="rounded-t-xl p-0 overflow-hidden flex items-center justify-center asset-preview h-[160px] sm:h-[200px] xl:h-[240px] bg-default/40">
                  <a
                    href={asset.url}
                    target="_blank"
                    className="flex items-center justify-center w-full h-full min-h-[128px]"
                  >
                    <div className="bg-default/40 rounded-full h-[72px] w-[72px] flex items-center justify-center group-hover/asset:scale-110 transition-transform duration-500 ease-out asset-icon-wrapper">
                      <FiLink size={40} className="text-success" />
                    </div>
                  </a>
                </CardBody>
                <CardFooter className="p-4 flex flex-col items-start rounded-b-xl bg-white asset-details">
                  <h3 className="text-dark text-start text-base font-bold text-ellipsis overflow-hidden mt-1 w-full">
                    {asset.title}
                  </h3>
                  {/* {asset.description && (
                    <p className="text-gray-600 text-start text-sm mt-1 line-clamp-2">
                      {asset.description}
                    </p>
                  )} */}
                  {/* {asset.category && (
                    <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mt-2">
                      {asset.category}
                    </span>
                  )} */}
                  <div className="flex items-center gap-1 truncate text-xs mt-2 w-full">
                    <a
                      href={asset.url}
                      target="_blank"
                      className="text-primary inline-flex items-center space-x-2 hover:underline cursor-pointer fp-link flex-1 truncate w-full"
                    >
                      <FiLink size={16} className="mr-2" />
                      <span className="">{new URL(asset.url).hostname}</span>
                    </a>
                  </div>
                </CardFooter>
              </Card>
            ))
          ) : searchTerm ? (
            <div className="col-span-full text-center py-12">
              <div className="text-gray-500">
                <FiLink size={48} className="mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Assets
                </h3>
                <p className="text-gray-600">
                  No assets match your search for "{searchTerm}"
                </p>
              </div>
            </div>
          ) : (
            <div className="col-span-full text-center py-12">
              <div className="text-gray-500">
                <FiLink size={48} className="mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Assets Available
                </h3>
                <p className="text-gray-600">
                  No assets are currently available.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
