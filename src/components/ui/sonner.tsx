import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[color:var(--cascata-abyss)] group-[.toaster]:text-[color:var(--cascata-white)] group-[.toaster]:border-transparent group-[.toaster]:rounded-sm group-[.toaster]:shadow-[0_10px_24px_rgba(6,25,43,0.26)]",
          description: "group-[.toast]:text-[color:#AEBDCB]",
          actionButton:
            "group-[.toast]:bg-[color:var(--cascata-navy)] group-[.toast]:text-[color:var(--cascata-white)]",
          cancelButton: "group-[.toast]:bg-transparent group-[.toast]:text-[color:#AEBDCB]",
          success: "group-[.toaster]:[&_[data-icon]]:text-[color:var(--cascata-inflow)]",
          warning: "group-[.toaster]:[&_[data-icon]]:text-[color:var(--cascata-gold)]",
          error: "group-[.toaster]:[&_[data-icon]]:text-[color:var(--cascata-outflow)]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
