import { PageHeader } from "@/components/PageHeader";
import { PersonForm } from "@/components/forms";

export default function NewPersonPage() {
  return (
    <>
      <PageHeader back={{ href: "/", label: "Trang chủ" }} title="Thêm hồ sơ" />
      <PersonForm />
    </>
  );
}
