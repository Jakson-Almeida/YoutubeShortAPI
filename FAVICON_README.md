# Logo e Favicon

Este projeto inclui um logo e favicon customizados para o YouTube Shorts Downloader.

## Arquivos Criados

- `public/favicon.svg` - Favicon em formato SVG (suportado por navegadores modernos)
- `public/logo.svg` - Logo completo do projeto
- `src/components/Logo.js` - Componente React reutilizável do logo
- `src/components/Logo.css` - Estilos do componente logo
- `public/manifest.json` - Manifest para PWA

## Favicon.ico (Opcional)

O favicon SVG já funciona na maioria dos navegadores modernos. Se você precisar de um arquivo `.ico` para compatibilidade com navegadores mais antigos, você pode:

1. **Converter online:**
   - Acesse https://favicon.io/favicon-converter/
   - Faça upload do arquivo `public/favicon.svg`
   - Baixe o arquivo `favicon.ico` gerado
   - Coloque-o em `public/favicon.ico`

2. **Ou usar ferramentas como:**
   - ImageMagick: `convert favicon.svg -resize 32x32 favicon.ico`
   - Online converter: https://convertio.co/svg-ico/

## Usando o Logo nos Componentes

O componente `Logo` está disponível e pode ser usado assim:

```jsx
import Logo from '../components/Logo';

// Logo pequeno
<Logo size="small" showText={false} />

// Logo médio (padrão)
<Logo size="medium" showText={true} />

// Logo grande
<Logo size="large" showText={true} />
```

## Design

O logo representa:
- **Círculo com gradiente roxo** - Identidade visual do projeto
- **Ícone de play** - Representa vídeos
- **Seta de download** - Representa a funcionalidade de download

As cores seguem o tema do projeto:
- Gradiente: `#667eea` → `#764ba2`

