import logo from "../../public/logo.png";


export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="logo">
          <img alt="logo" src={logo.src} />
        </div>
        <div className="rights">Все права защищены</div>
      </div>
    </footer>
  );
}
