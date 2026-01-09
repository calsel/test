// app/page.jsx (или pages/index.jsx)
"use client";

import { useState } from "react";
import MainContent from "./components/MainContent";
import Cars from "./components/Cars";
import Order from "./components/Order";

export default function Page() {
  const [form, setForm] = useState({ car: "", name: "", phone: "" });

  const isError = (field: "car" | "name" | "phone") => !form[field];

  const onSelectCar = (title: string) => setForm((p) => ({ ...p, car: title }));

  const sendOrder = async (e) => {
    e.preventDefault();
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "/api/sendOrder";
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (parseErr) {
        data = text;
      }

      if (res.ok && data && data.ok) {
        alert("Заявка отправлена, спасибо!");
        setForm({ car: "", name: "", phone: "" });
      } else {
        console.error({ status: res.status, body: data });
        alert("Ошибка при отправке заявки — см. консоль");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка сети");
    }
  };

  return (
    <>
      <MainContent />
      <Cars onSelectCar={onSelectCar} />
      <Order form={form} setForm={setForm} isError={isError} onSubmit={sendOrder} />
    </>
  );
}
