import '../src/index.css';

export const metadata = {
    title: 'Pulse Play',
    description: 'Live cricket prediction room powered by AI.',
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
