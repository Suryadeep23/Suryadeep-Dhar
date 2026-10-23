/**
 * Generates a valid multi-page PDF byte array without external dependencies.
 */
export function buildPdfFromPages(pagesContent: {
  title: string;
  subtitle: string;
  date: string;
  sections: string[];
  points: string[];
}[]): Uint8Array {
  let pdf = '%PDF-1.4\n';
  const objects: string[] = [];

  const fontObjId = 3;
  const pageObjIds: number[] = [];

  let currentObjId = 4;
  const pageTuples: { pageId: number; streamId: number; text: string }[] = [];

  pagesContent.forEach((p, idx) => {
    const streamId = currentObjId++;
    const pageId = currentObjId++;
    pageObjIds.push(pageId);

    let streamText = `BT
/F1 20 Tf
50 720 Td
(${escapePdfText(p.title)}) Tj
0 -26 Td
/F1 12 Tf
(${escapePdfText(p.subtitle)}) Tj
0 -18 Td
/F1 10 Tf
(${escapePdfText(p.date)}) Tj
0 -40 Td
/F1 12 Tf
`;

    p.sections.forEach((sec) => {
      streamText += `(${escapePdfText(sec)}) Tj\n0 -22 Td\n`;
    });

    streamText += `0 -20 Td\n/F1 11 Tf\n`;
    p.points.forEach((pt) => {
      streamText += `(${escapePdfText(pt)}) Tj\n0 -20 Td\n`;
    });

    streamText += `0 -50 Td\n/F1 9 Tf\n([ Page ${idx + 1} of ${pagesContent.length} - SecureDoc View-Only Link Protected ]) Tj\nET`;

    pageTuples.push({ pageId, streamId, text: streamText });
  });

  const catalog = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  const pagesList = pageObjIds.map((id) => `${id} 0 R`).join(' ');
  const pagesRoot = `2 0 obj\n<< /Type /Pages /Kids [${pagesList}] /Count ${pageObjIds.length} >>\nendobj\n`;
  const font = `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;

  let body = catalog + pagesRoot + font;

  pageTuples.forEach(({ pageId, streamId, text }) => {
    const streamObj = `${streamId} 0 obj\n<< /Length ${text.length} >>\nstream\n${text}\nendstream\nendobj\n`;
    const pageObj = `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 3 0 R >> >> /MediaBox [0 0 595 842] /Contents ${streamId} 0 R >>\nendobj\n`;
    body += streamObj + pageObj;
  });

  const totalObjects = 3 + pageTuples.length * 2;
  const offsets: number[] = [0];

  const fullContent = pdf + body;
  for (let i = 1; i <= totalObjects; i++) {
    const actualPos = fullContent.indexOf(`${i} 0 obj`);
    offsets.push(actualPos !== -1 ? actualPos : 0);
  }

  const xrefOffset = fullContent.length;
  let xref = `xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= totalObjects; i++) {
    const pos = offsets[i] || 0;
    xref += `${pos.toString().padStart(10, '0')} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  const finalPdfStr = fullContent + xref + trailer;

  const bytes = new Uint8Array(finalPdfStr.length);
  for (let i = 0; i < finalPdfStr.length; i++) {
    bytes[i] = finalPdfStr.charCodeAt(i) & 0xff;
  }
  return bytes;
}

function escapePdfText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function generateSamplePdfBytes(): Uint8Array {
  return buildPdfFromPages([
    {
      title: 'CONFIDENTIAL INVESTMENT DECK',
      subtitle: 'Series B Strategic Expansion & Product Roadmap',
      date: 'Fiscal Year 2026-2027 • Strictly Private & Confidential',
      sections: [
        'Notice: This document contains proprietary and legally privileged information.',
        'Distribution, copying, or forwarding of this document is strictly prohibited.',
        'Recipient is bound by Non-Disclosure Agreement (NDA) Section 4.2.',
      ],
      points: [
        '1. Executive Summary & Market Trajectory',
        '2. Projected ARR Growth: $4.2M -> $18.5M (340% YoY)',
        '3. Enterprise Customer Retention Rate: 138% NRR',
        '4. Global Infrastructure Scaling & IP Architecture',
      ],
    },
    {
      title: 'FINANCIAL HIGHLIGHTS & UNIT ECONOMICS',
      subtitle: 'Q1-Q4 Audited Performance & Forward Forecasts',
      date: 'Prepared for Accredited Investors Only',
      sections: [
        'Key Operating Metrics:',
        '• Gross Margin: 82.4% with cloud unit optimization',
        '• Customer Acquisition Cost (CAC) Payback: 6.8 Months',
        '• Magic Number: 1.42 (Tier 1 SaaS benchmark)',
      ],
      points: [
        'R&D Capital Allocation: 45% to Autonomous AI Engine',
        'Go-To-Market & International Sales: 35%',
        'Working Capital & Strategic M&A Reserves: 20%',
        'Target Valuation Post-Round: $120M',
      ],
    },
  ]);
}

export function generateSamplePdfBase64(): string {
  return bytesToBase64(generateSamplePdfBytes());
}

import { PdfDocumentItem } from '../types/document';

// Generate a complete 3-document data room bundle in 1 link!
export function generateSampleMultiDocumentBundle(): PdfDocumentItem[] {
  // Document 1: The Helping Squad - Volunteer & Community Handbook (2 pages)
  const doc1Bytes = buildPdfFromPages([
    {
      title: 'THE HELPING SQUAD - VOLUNTEER HANDBOOK',
      subtitle: 'Community Outreach, Ethics & Field Operations Guide',
      date: 'THE HELPING SQUAD • OFFICIAL PUBLICATION 2026',
      sections: [
        'Welcome to The Helping Squad! Our mission is to empower communities,',
        'provide rapid humanitarian assistance, and foster grassroots collaboration.',
        'Core Pillars: Compassion in Action, Radical Transparency, and Rapid Response.',
      ],
      points: [
        '• Code of Conduct: Mutual respect, dignity, and zero tolerance for harassment',
        '• Safety First: Follow buddy systems and wear designated Helping Squad badges',
        '• Reporting: Submit post-dispatch situation logs within 24 hours of field missions',
      ],
    },
    {
      title: 'THE HELPING SQUAD - FIELD PROTOCOLS',
      subtitle: 'Emergency Deployment & Community Engagement Standards',
      date: 'Handbook Document 1 of 3 in this secure link',
      sections: [
        'When deployed on-site, Squad Coordinators coordinate resource drops,',
        'food distribution hubs, medical supplies, and educational workshops.',
      ],
      points: [
        '• Point of Contact: Designated Squad Lead handles local partner coordination',
        '• Data Privacy: Treat beneficiary and community records with strict confidentiality',
      ],
    },
  ]);

  // Document 2: The Helping Squad - Emergency Relief & Logistics Guide (2 pages)
  const doc2Bytes = buildPdfFromPages([
    {
      title: 'THE HELPING SQUAD - EMERGENCY LOGISTICS',
      subtitle: 'Disaster Relief Supply Chains & Rapid Response SOP',
      date: 'THE HELPING SQUAD • DISPATCH DIRECTIVE',
      sections: [
        'Logistics Framework for Rapid Response Teams:',
        '• Tier 1: Immediate First Aid, Clean Water, and Non-Perishable Rations',
        '• Tier 2: Temporary Shelter, Power Stations, and Satellite Comms',
        '• Tier 3: School Re-entry Packs, Trauma Counseling, and Recovery Grants',
      ],
      points: [
        '• Fleet & Transport: Electric cargo vans and all-terrain supply carriers',
        '• Inventory Check: Barcode verified before every regional dispatch',
      ],
    },
    {
      title: 'THE HELPING SQUAD - WAREHOUSE MANAGEMENT',
      subtitle: 'Storage, Quality Audits & Cold Chain Protocols',
      date: 'Handbook Document 2 of 3 in this secure link',
      sections: [
        'Standard Operating Procedure for Medical & Food Warehouses:',
        'Temperature-controlled storage maintains integrity of emergency medical vials.',
      ],
      points: [
        '• Regular 48-hour cycle audits ensure zero spoilage or loss',
        '• 100% of incoming donor shipments logged into the Squad Ledger',
      ],
    },
  ]);

  // Document 3: The Helping Squad - Governance Charter & Donor Transparency (1 page)
  const doc3Bytes = buildPdfFromPages([
    {
      title: 'THE HELPING SQUAD - GOVERNANCE CHARTER',
      subtitle: 'Financial Stewardship, Audit Reports & Public Transparency',
      date: 'THE HELPING SQUAD • BOARD OF DIRECTORS CHARTER',
      sections: [
        '1. Stewardship Commitment: 94% of every contributed dollar goes directly',
        'into community aid programs, logistics, and field supplies.',
        '2. Annual Independent Audits: Published publicly with zero concealment.',
        '3. View-Only Distribution: Sensitive operational manuals are shared through',
        'this single secure view-only link to prevent unauthorized alterations.',
      ],
      points: [
        '• Board Chair: Dr. Elena Rostova / Field Director: Marcus Vance',
        '• Accreditation: Rated Platinum Transparency by Independent Charity Watch',
        '• Official Seal: Verified by The Helping Squad Secretariat',
      ],
    },
  ]);

  return [
    {
      id: 'ths_f1',
      title: 'The Helping Squad - Volunteer Handbook',
      originalFilename: '1_The_Helping_Squad_Volunteer_Handbook.pdf',
      fileSize: doc1Bytes.byteLength,
      pageCount: 2,
      pdfBase64: bytesToBase64(doc1Bytes),
    },
    {
      id: 'ths_f2',
      title: 'The Helping Squad - Emergency Logistics Guide',
      originalFilename: '2_The_Helping_Squad_Emergency_Logistics.pdf',
      fileSize: doc2Bytes.byteLength,
      pageCount: 2,
      pdfBase64: bytesToBase64(doc2Bytes),
    },
    {
      id: 'ths_f3',
      title: 'The Helping Squad - Governance & Transparency Charter',
      originalFilename: '3_The_Helping_Squad_Governance_Charter.pdf',
      fileSize: doc3Bytes.byteLength,
      pageCount: 1,
      pdfBase64: bytesToBase64(doc3Bytes),
    },
  ];
}
