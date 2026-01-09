"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

type Car = {
  title: string;
  text: string;
  image: string;        // например "https://testologia.ru/cars-images/1.png"
  prices: (string | number)[];
};

type Filter = {
  name: string;
  active: boolean;
  value: string;        // что отправляем в API как filter
};

type Props = {
  onSelectCar?: (title: string) => void;
};

export default function Cars({ onSelectCar }: Props) {
  const carsContentRef = useRef<HTMLDivElement | null>(null);

  const [cars, setCars] = useState<Car[]>([]);
  const [carsFilter, setCarsFilter] = useState<Filter[]>([
    { active: true, name: "Все марки", value: "" },
    { active: false, name: "Lamborghini", value: "Lamborghini" },
    { active: false, name: "Ferrari", value: "Ferrari" },
    { active: false, name: "Porsche", value: "Porsche" },
    { active: false, name: "BMW", value: "BMW" },
    { active: false, name: "Mercedes", value: "Mercedes" },
    { active: false, name: "Chevrolet", value: "Chevrolet" },
    { active: false, name: "Audi", value: "Audi" },
    { active: false, name: "Ford", value: "Ford" },
  ]);

  const activeFilterValue = useMemo(
    () => carsFilter.find((f) => f.active)?.value ?? "",
    [carsFilter]
  );

  const periods = ["на 1 сутки", "на 1-3 суток", "на 3+ суток"];

  // загрузка машин по фильтру
  useEffect(() => {
    const url = new URL("https://testologia.ru/cars-data");
    url.searchParams.set("filter", activeFilterValue);

    fetch(url)
      .then((r) => r.json())
      .then((data) => setCars(Array.isArray(data) ? data : []))
      .catch(() => setCars([]));
  }, [activeFilterValue]);

  const changeFilter = (filter: Filter) => {
    setCarsFilter((prev) =>
      prev.map((f) => ({ ...f, active: f.name === filter.name }))
    );
    carsContentRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleBook = (carTitle: string) => {
    onSelectCar?.(carTitle);
    document.querySelector("#order")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="cars" className="cars">
      <div className="container">
        <h2>Выберите автомобиль</h2>

        <div ref={carsContentRef} className="cars-content">
          <aside className="cars-filter">
            <ul>
              {carsFilter.map((filter) => (
                <li
                  key={filter.name}
                  className={filter.active ? "active" : ""}
                  onClick={() => changeFilter(filter)}
                >
                  {filter.name}
                </li>
              ))}
            </ul>
          </aside>

          <div className="cars-items">
            {cars.map((car) => (
              <article className="car" key={car.title}>
                <Image
                  alt="car"
                  src={car.image}
                  width={520}
                  height={300}
                />

                <div className="car-detail">
                  <h4>{car.title}</h4>
                  <p>{car.text}</p>

                  <div className="car-action">
                    <ul>
                      {periods.map((period, i) => (
                        <li key={period}>
                          <div className="car-period">{period}</div>
                          <div className="car-price">
                            {car.prices?.[i]} $ {i > 0 && <span>/сут</span>}
                          </div>
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      className="button white-button"
                      onClick={() => handleBook(car.title)}
                    >
                      Забронировать
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
