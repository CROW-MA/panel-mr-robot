import { FC } from "react";
import { QRCodeSVG } from "qrcode.react";

interface QRModalProps {
  qr: string;
  onClose: () => void;
}

const QRModal: FC<QRModalProps> = ({ qr, onClose }) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white p-6 rounded shadow-md">
        <h2 className="text-xl font-bold mb-4">Escanea QR para vincular WhatsApp</h2>
        <QRCodeSVG value={qr} size={200} />
        <button onClick={onClose} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">Cerrar</button>
      </div>
    </div>
  );
};

export default QRModal;
