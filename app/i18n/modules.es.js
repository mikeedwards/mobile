module.exports = {
    modules: {
        water: {
            ec: {
                name: "Water Conductivity",
                sensors: {
                    ec: "Conductivity",
                    tds: "Total Dissolved Solids",
                    salinity: "Salinity"
                }
            },
            ph: {
                name: "Water pH",
                sensors: {
                    ph: "pH"
                }
            },
            do: {
                name: "Water Dissolved Oxygen",
                sensors: {
                    do: "Dissolved Oxygen"
                }
            },
            temp: {
                name: "Water Temperature",
                sensors: {
                    temp: "Temperature"
                }
            },
            orp: {
                name: "Water ORP",
                sensors: {
                    orp: "ORP"
                }
            },
            unknown: {
                name: "Water"
            },
        },
        weather: {
            name: "Weather",
            sensors: {
                humidity: "Humidity",
                temperature_1: "Temperature 1",
                pressure: "Pressure",
                temperature_2: "Temperature 2",
                rain: "Rain",
                wind_speed: "Wind Speed",
                wind_dir: "Wind Direction",
                wind_dir_mv: "Wind Direction Raw ADC",
                wind_hr_max_speed: "Wind Max Speed (1 hour)",
                wind_hr_max_dir: "Wind Max Direction (1 hour)",
                wind_10m_max_speed: "Wind Max Speed (10 min)",
                wind_10m_max_dir: "Wind Max Direction (10 min)",
                wind_2m_avg_speed: "Wind Average Speed (2 min)",
                wind_2m_avg_dir: "Wind Average Direction (2 min)",
                rain_this_hour: "Rain This Hour",
                rain_prev_hour: "Rain Previous Hour"
            }
        },
        distance: {
            name: "Distance",
            sensors: {
                distance_0: "Distance 0",
                distance_1: "Distance 1",
                distance_2: "Distance 2",
                calibration: "Calibration"
            }
        },
        diagnostics: {
            name: "Diagnostics",
            sensors: {
                battery_charge: "Battery Charge",
                battery_voltage: "Battery Voltage",
                battery_vbus: "Battery Bus Voltage",
                battery_vs: "Battery Shunt Voltage",
                battery_ma: "Battery Current",
                battery_power: "Battery Power",
                free_memory: "Free Memory",
                uptime: "Uptime",
                temperature: "Temperature"
            }
        },
        random: {
            name: "Random",
            sensors: {
                random_0: "Random 0",
                random_1: "Random 1",
                random_2: "Random 2",
                random_3: "Random 3",
                random_4: "Random 4",
                random_5: "Random 5",
                random_6: "Random 6",
                random_7: "Random 7",
                random_8: "Random 8",
                random_9: "Random 9"
            }
        }
    }
}