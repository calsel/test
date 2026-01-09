import logo from "../../public/logo.png";


export default function Header() {
  return (
    <header className="header">
        <div className="container">
            <div className="logo">
                <img alt="logo" src={logo.src}/>
            </div>
            <nav className="menu">
                <ul>
                    <li>
                        <a href="#cars">автопарк</a>
                    </li>
                    <li>
                        <a href="#order">Забронировать</a>
                    </li>
                </ul>
            </nav>
            <a className="phone" href="tel:+971523898989">+971 52 389 89 89</a>
        </div>
    </header>
  );
}
