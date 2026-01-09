"use client";

import Image from "next/image";
import orderCar from "../../public/order-car.png";
import { useEffect, useState } from "react";

type OrderForm = {
  car: string;
  name: string;
  phone: string;
};

type Props = {
  // можно оставлять входной стиль (например, из родителя), но мы добавим к нему свой
  orderImgStyle?: React.CSSProperties;

  form: OrderForm;
  setForm: React.Dispatch<React.SetStateAction<OrderForm>>;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isError: (field: keyof OrderForm) => boolean;
};

export default function Order({
  orderImgStyle = {},
  form,
  setForm,
  onSubmit,
  isError,
}: Props) {
  // локальные стили от событий (как было в Angular)
  const [scrollStyle, setScrollStyle] = useState<React.CSSProperties>({});
  const [mouseStyle, setMouseStyle] = useState<React.CSSProperties>({});

  // Scroll (пример): вычисляем right как в Angular mainImgStyle
  useEffect(() => {
    const onScroll = () => {
      const offSetRight = -576 + window.scrollY * 0.2;
      setScrollStyle({ right: `${offSetRight}px` });
    };

    document.addEventListener("scroll", onScroll);
    onScroll();

    return () => {
      document.removeEventListener("scroll", onScroll);
    };
  }, []); // addEventListener + cleanup [web:204]

  // MouseMove: вычисляем transform как в Angular orderImgStyle
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      setMouseStyle({
        transform: `translate3d(${(e.clientX * 0.3) / 8}px, ${(e.clientY * 0.3) / 8}px, 0)`,
      });
    };

    document.addEventListener("mousemove", onMouseMove);

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
    };
  }, []); // addEventListener + cleanup [web:208]

  const isValid = !!form.car && !!form.name && form.phone.trim().length >= 10;

  return (
    <section id="order" className="order">
      <div className="container">
        <Image
          alt="order-car"
          src={orderCar.src}
          width={900}
          height={500}
          // объединяем: входной стиль + scrollStyle + mouseStyle
          style={{ ...orderImgStyle, ...scrollStyle, ...mouseStyle }}
        />

        <form onSubmit={onSubmit}>
          <div className="order-form">
            <h3>Забронируйте автомобиль</h3>
            <p>
              Заполните контактные данные, и мы перезвоним вам для обсуждения
              деталей и подтверждения бронирования
            </p>

            <input
              placeholder="Автомобиль"
              id="car"
              required
              readOnly
              type="text"
              value={form.car}
              className={isError("car") ? "error" : ""}
            />

            <input
              placeholder="Ваше имя"
              id="name"
              required
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className={isError("name") ? "error" : ""}
            />

            <input
              placeholder="Ваш телефон"
              id="phone"
              required
              type="text"
              minLength={10}
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              className={isError("phone") ? "error" : ""}
            />

            <button className="button" type="submit" id="order-action" disabled={!isValid}>
              Забронировать
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
