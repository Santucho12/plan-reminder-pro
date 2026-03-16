import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group mt-[260px]"
      position="top-center"
      closeButton={true}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-2xl text-lg p-8 w-[600px] max-w-[90vw] flex items-start gap-5 rounded-2xl border-l-[8px] border border-y border-r",
          description: "group-[.toast]:text-muted-foreground mt-2 text-base",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground font-semibold px-5 py-2.5 rounded-md",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:border-l-emerald-500 group-[.toaster]:bg-white dark:group-[.toaster]:bg-slate-900",
          error: "group-[.toaster]:border-l-destructive",
          title: "font-bold tracking-tight text-2xl text-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
