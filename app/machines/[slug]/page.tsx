import { notFound } from "next/navigation";
import MachineLab from "@/components/MachineLab";
import { getMachine } from "@/lib/machines";

export default function MachinePage({ params }: { params: { slug: string } }) {
  const machine = getMachine(params.slug);
  if (!machine) return notFound();
  return <MachineLab machine={machine} />;
}
