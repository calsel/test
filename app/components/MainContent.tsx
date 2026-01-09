"use client";

import { useEffect, useState } from "react";
import mainCar from "../../public/main-car.png";
import Image from "next/image";

export default function Hero() {
  const [mainImgStyle, setMainImgStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const onScroll = () => {
      const offSetRight = -576 + window.scrollY * 0.2;
      setMainImgStyle({ right: `${offSetRight}px` });
    };

    document.addEventListener("scroll", onScroll);
    onScroll(); // выставить стиль сразу

    return () => {
      document.removeEventListener("scroll", onScroll);
    };
  }, []); // addEventListener + cleanup [web:204]

  return (
    <>
      <section className="main-content">
        <div className="container">
          <div className="main-info">
            <h1>Покорите дороги за рулём легендарных автомобилей!</h1>
            <p>
              От эксклюзивных спорткаров до гоночных шедевров — выбирайте мечту,
              садитесь за руль и ощутите мощь премиального авто на полную!
            </p>

            <a id="main-action-button" className="button" href="#cars">
              Посмотреть автомобили
            </a>
          </div>

          <Image
            className="body-img"
            src={mainCar.src}
            alt="main-car"
            width={1200}
            height={600}
            style={mainImgStyle}
            priority
          />
        </div>
      </section>
    </>
  );
}
