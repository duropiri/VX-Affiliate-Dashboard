"use client";

import { Button } from "@heroui/react";
import { useEffect } from "react";
import { IoMdRefresh } from "react-icons/io";


export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    /* eslint-disable no-console */
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <h2>Something went wrong!</h2>
      <Button
        onPress={
          // Attempt to recover by trying to re-render the segment
          () => reset()
        }
        color="primary"
        variant="flat"
        size="sm"
        radius="sm"
        className="mt-4"
        startContent={<IoMdRefresh size={20} />}
      >
        Try again
      </Button>
    </div>
  );
}
