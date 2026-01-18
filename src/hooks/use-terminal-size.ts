import { useEffect, useState } from "react";

interface TerminalSize {
  width: number;
  height: number;
}

export const useTerminalSize = (): TerminalSize => {
  const [size, setSize] = useState<TerminalSize>({
    width: process.stdout.columns,
    height: process.stdout.rows,
  });

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: process.stdout.columns,
        height: process.stdout.rows,
      });
    };

    // Listen for terminal resize events
    process.stdout.on("resize", handleResize);

    // Cleanup listener on unmount
    return () => {
      process.stdout.off("resize", handleResize);
    };
  }, []);

  return size;
};