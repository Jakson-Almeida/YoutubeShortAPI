import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './UserMenu.css';

const UserMenu = ({ user, logout, currentPage, onLogin, onRegister }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) {
    return (
      <div className="auth-buttons">
        <button onClick={onLogin} className="btn-auth btn-login">Entrar</button>
        <button onClick={onRegister} className="btn-auth btn-register">Cadastrar</button>
      </div>
    );
  }

  return (
    <div className="user-menu-container" ref={menuRef}>
      {currentPage === 'home' && (
        <Link to="/pro" className="nav-link-highlight pro">
          ⭐ Pro
        </Link>
      )}
      {currentPage === 'pro' && (
        <Link to="/" className="nav-link-highlight home">
          🏠 Início
        </Link>
      )}

      <div className="user-avatar-trigger" onClick={() => setIsOpen(!isOpen)} title="Menu do usuário">
        <div className="user-avatar">
          {user.email.charAt(0).toUpperCase()}
        </div>
      </div>

      {isOpen && (
        <div className="user-dropdown">
          <div className="user-info">
            <span className="user-email-label">Logado como</span>
            <span className="user-email" title={user.email}>{user.email}</span>
          </div>
          <div className="dropdown-divider"></div>
          <button onClick={logout} className="dropdown-item logout">
            <span className="icon">🚪</span> Sair
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;



