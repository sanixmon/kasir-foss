import React, { useState, useEffect } from 'react';

function LiveClock() {
  const [time, setTime] = useState('00:00:00');
  const [date, setDate] = useState('—');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toTimeString().slice(0, 8));
      const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
      const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
      setDate(`${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-end">
      <div className="clock-time">{time}</div>
      <div className="clock-date d-none d-sm-block">{date}</div>
    </div>
  );
}

export default LiveClock;
