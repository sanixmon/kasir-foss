-- Simulasi weekend rame: Sabtu 23 Agustus 2026
-- Outlet Pusat (outlet-1) + Outlet Cabang 2 (outlet-2)
-- Item sesuai katalog: ST=Stroller, SB=Stroller Paket 3J, SD=Scooter Dewasa, SJ=Scooter Jumbo, SA=Scooter Anak

DELETE FROM transactions WHERE id LIKE 'wknd-%';

INSERT INTO transactions (id, outlet_id, no, queue_no, nama, tanggal, start_time, end_time, items, ot, ot_dur, total_base, total_ot, total_tol, grand_total, total_all, pay_awal, cash, qris, shift) VALUES
-- ===== OUTLET PUSAT - SHIFT PAGI =====
('wknd-p01','outlet-1',1,1,'Keluarga Hendra','2026-08-23',1756000800000,1756004400000,'[{"code":"ST","name":"Stroller","qty":1,"harga":20000}]','-','-',20000,0,0,0,20000,'cash',20000,0,'PAGI'),
('wknd-p02','outlet-1',2,2,'Ibu Sari','2026-08-23',1756001400000,1756005000000,'[{"code":"SB","name":"Stroller Paket 3J","qty":1,"harga":50000}]','-','-',50000,0,0,0,50000,'qris',0,50000,'PAGI'),
('wknd-p03','outlet-1',3,3,'Pak Budi','2026-08-23',1756001800000,1756005400000,'[{"code":"SD","name":"Scooter Dewasa","qty":1,"harga":50000}]','-','-',50000,0,0,0,50000,'cash',50000,0,'PAGI'),
('wknd-p04','outlet-1',4,4,'Anak Rani 2x','2026-08-23',1756002000000,1756006200000,'[{"code":"SA","name":"Scooter Anak","qty":2,"harga":35000}]','OT','30 menit',70000,20000,0,0,90000,'qris',0,90000,'PAGI'),
('wknd-p05','outlet-1',5,5,'Keluarga Susanto','2026-08-23',1756002600000,1756006200000,'[{"code":"SJ","name":"Scooter Jumbo","qty":1,"harga":60000}]','-','-',60000,0,0,0,60000,'cash',60000,0,'PAGI'),
('wknd-p06','outlet-1',6,6,'Arief & Teman','2026-08-23',1756003000000,1756009800000,'[{"code":"SD","name":"Scooter Dewasa","qty":2,"harga":50000}]','OT','60 menit',100000,50000,0,0,150000,'qris',0,150000,'PAGI'),
('wknd-p07','outlet-1',7,7,'Ibu Dini','2026-08-23',1756003600000,1756007200000,'[{"code":"ST","name":"Stroller","qty":1,"harga":20000}]','-','-',20000,0,0,0,20000,'cash',20000,0,'PAGI'),
('wknd-p08','outlet-1',8,8,'Pak Wahyu Fam','2026-08-23',1756004200000,1756007800000,'[{"code":"SB","name":"Stroller Paket 3J","qty":1,"harga":50000},{"code":"SA","name":"Scooter Anak","qty":1,"harga":35000}]','-','-',85000,0,0,0,85000,'cash',85000,0,'PAGI'),
('wknd-p09','outlet-1',9,9,'Nur Fadilah','2026-08-23',1756005000000,1756008600000,'[{"code":"ST","name":"Stroller","qty":1,"harga":20000}]','-','-',20000,0,0,0,20000,'qris',0,20000,'PAGI'),
('wknd-p10','outlet-1',10,10,'Rizky Kids','2026-08-23',1756005600000,1756010800000,'[{"code":"SA","name":"Scooter Anak","qty":3,"harga":35000}]','OT','30 menit',105000,30000,0,0,135000,'cash',135000,0,'PAGI'),
-- ===== OUTLET PUSAT - SHIFT SIANG =====
('wknd-s01','outlet-1',11,1,'Keluarga Pratama','2026-08-23',1756022400000,1756026000000,'[{"code":"SJ","name":"Scooter Jumbo","qty":1,"harga":60000}]','-','-',60000,0,0,0,60000,'cash',60000,0,'SIANG'),
('wknd-s02','outlet-1',12,2,'Mira & Keluarga','2026-08-23',1756023000000,1756026600000,'[{"code":"ST","name":"Stroller","qty":2,"harga":20000}]','-','-',40000,0,0,0,40000,'qris',0,40000,'SIANG'),
('wknd-s03','outlet-1',13,3,'Ari Santoso','2026-08-23',1756023600000,1756028800000,'[{"code":"SD","name":"Scooter Dewasa","qty":1,"harga":50000}]','OT','60 menit',50000,50000,0,0,100000,'cash',100000,0,'SIANG'),
('wknd-s04','outlet-1',14,4,'Bu Lestari','2026-08-23',1756024200000,1756027800000,'[{"code":"SB","name":"Stroller Paket 3J","qty":1,"harga":50000}]','-','-',50000,0,0,0,50000,'qris',0,50000,'SIANG'),
('wknd-s05','outlet-1',15,5,'Dendi Yusuf','2026-08-23',1756025000000,1756029200000,'[{"code":"SA","name":"Scooter Anak","qty":2,"harga":35000},{"code":"ST","name":"Stroller","qty":1,"harga":20000}]','OT','30 menit',90000,20000,0,0,110000,'cash',110000,0,'SIANG'),
('wknd-s06','outlet-1',16,6,'Pak Hasan Fam','2026-08-23',1756025800000,1756030600000,'[{"code":"SJ","name":"Scooter Jumbo","qty":1,"harga":60000}]','OT','30 menit',60000,25000,0,0,85000,'qris',0,85000,'SIANG'),
('wknd-s07','outlet-1',17,7,'Yeni & Anak','2026-08-23',1756027000000,1756030600000,'[{"code":"SA","name":"Scooter Anak","qty":1,"harga":35000}]','-','-',35000,0,0,0,35000,'cash',35000,0,'SIANG'),
('wknd-s08','outlet-1',18,8,'Rudi Hartono','2026-08-23',1756028000000,1756032000000,'[{"code":"SD","name":"Scooter Dewasa","qty":1,"harga":50000}]','-','-',50000,0,0,0,50000,'cash',50000,0,'SIANG'),
-- ===== OUTLET CABANG 2 - SHIFT PAGI =====
('wknd-c01','outlet-2',1,1,'Keluarga Anwar','2026-08-23',1756001200000,1756004800000,'[{"code":"ST","name":"Stroller","qty":1,"harga":20000}]','-','-',20000,0,0,0,20000,'cash',20000,0,'PAGI'),
('wknd-c02','outlet-2',2,2,'Pak Tono Kids','2026-08-23',1756001800000,1756006600000,'[{"code":"SA","name":"Scooter Anak","qty":2,"harga":35000}]','OT','30 menit',70000,20000,0,0,90000,'qris',0,90000,'PAGI'),
('wknd-c03','outlet-2',3,3,'Ibu Yanti','2026-08-23',1756002400000,1756006000000,'[{"code":"SB","name":"Stroller Paket 3J","qty":1,"harga":50000}]','-','-',50000,0,0,0,50000,'cash',50000,0,'PAGI'),
('wknd-c04','outlet-2',4,4,'Keluarga Nugroho','2026-08-23',1756003000000,1756007200000,'[{"code":"SD","name":"Scooter Dewasa","qty":1,"harga":50000},{"code":"SA","name":"Scooter Anak","qty":1,"harga":35000}]','-','-',85000,0,0,0,85000,'qris',0,85000,'PAGI'),
('wknd-c05','outlet-2',5,5,'Bapak Eko','2026-08-23',1756003600000,1756008000000,'[{"code":"SJ","name":"Scooter Jumbo","qty":1,"harga":60000}]','OT','60 menit',60000,60000,0,0,120000,'cash',120000,0,'PAGI'),
('wknd-c06','outlet-2',6,6,'Dian Permata','2026-08-23',1756004200000,1756007800000,'[{"code":"ST","name":"Stroller","qty":2,"harga":20000}]','-','-',40000,0,0,0,40000,'qris',0,40000,'PAGI'),
('wknd-c07','outlet-2',7,7,'Fauzan Family','2026-08-23',1756005000000,1756009400000,'[{"code":"SA","name":"Scooter Anak","qty":3,"harga":35000}]','OT','30 menit',105000,30000,0,0,135000,'cash',135000,0,'PAGI'),
('wknd-c08','outlet-2',8,8,'Bu Hartini','2026-08-23',1756005800000,1756009400000,'[{"code":"SB","name":"Stroller Paket 3J","qty":1,"harga":50000}]','-','-',50000,0,0,0,50000,'cash',50000,0,'PAGI'),
-- ===== OUTLET CABANG 2 - SHIFT SIANG =====
('wknd-cs1','outlet-2',9,1,'Gilang & Istri','2026-08-23',1756022800000,1756026400000,'[{"code":"ST","name":"Stroller","qty":1,"harga":20000}]','-','-',20000,0,0,0,20000,'qris',0,20000,'SIANG'),
('wknd-cs2','outlet-2',10,2,'Pak Ruslan Fam','2026-08-23',1756023400000,1756028200000,'[{"code":"SD","name":"Scooter Dewasa","qty":2,"harga":50000}]','OT','30 menit',100000,25000,0,0,125000,'cash',125000,0,'SIANG'),
('wknd-cs3','outlet-2',11,3,'Keluarga Irwan','2026-08-23',1756024000000,1756027600000,'[{"code":"SJ","name":"Scooter Jumbo","qty":1,"harga":60000}]','-','-',60000,0,0,0,60000,'qris',0,60000,'SIANG'),
('wknd-cs4','outlet-2',12,4,'Vina & Keluarga','2026-08-23',1756025000000,1756029200000,'[{"code":"SA","name":"Scooter Anak","qty":2,"harga":35000},{"code":"SB","name":"Stroller Paket 3J","qty":1,"harga":50000}]','OT','30 menit',120000,20000,0,0,140000,'cash',140000,0,'SIANG'),
('wknd-cs5','outlet-2',13,5,'Bagas Putra','2026-08-23',1756026000000,1756029600000,'[{"code":"SA","name":"Scooter Anak","qty":1,"harga":35000}]','-','-',35000,0,0,0,35000,'qris',0,35000,'SIANG'),
('wknd-cs6','outlet-2',14,6,'Marni & Anak','2026-08-23',1756027200000,1756031600000,'[{"code":"SD","name":"Scooter Dewasa","qty":1,"harga":50000}]','OT','60 menit',50000,50000,0,0,100000,'cash',100000,0,'SIANG');
