import React from 'react';
import styles from './kinetic-scroll.module.css';

export default function KineticScroll() {
    const items = [
        "detect.",
        "analyze.",
        "monitor.",
        "protect.",
        "alert.",
        "record.",
        "review.",
        "secure.",
        "scale.",
        "optimize.",
        "deploy.",
        "solve.",
        "sleep.",
        "repeat."
    ];

    return (
        <div className="w-full bg-black py-20 relative z-10">
            <section className={styles.hero}>
                <div>
                    <h1 className={styles.heroText}>You can relax</h1>
                    <p className={styles.heroDescription}>We watch over everything.</p>
                </div>
            </section>

            <section className={styles.listContainer}>
                <p className={styles.listText}>Cam4U can</p>

                <ul className={styles.list}>
                    {items.map((item, index) => (
                        <li
                            key={index}
                            className={styles.listLi}
                            style={{ "--i": index } as React.CSSProperties}
                        >
                            {item}
                        </li>
                    ))}
                </ul>
            </section>

            <section className={styles.hero}>
                <div>
                    <h1 className={styles.heroText}>Done.</h1>
                    <h1 className={styles.heroText}>Secured.</h1>
                    <p className={styles.heroDescription}>Until the next alert.</p>
                </div>
            </section>
        </div>
    );
}
