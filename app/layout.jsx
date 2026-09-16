import './globals.css';

export const metadata = {
  title: 'RAG Chatbot',
  description: 'Chat with your documents',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
